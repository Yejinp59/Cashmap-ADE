import os
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, date

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from sqlalchemy.orm import Session

from models import Company, Patent

logger = logging.getLogger("batch.kipris")

KIPRIS_API_KEY  = os.getenv("KIPRIS_API_KEY", "")
KIPRIS_BASE_URL = "http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice"

KIPRIS_MONTHLY_QUOTA = 1000   # 무료 플랜 월 호출 한도


def _build_session() -> requests.Session:
    sess = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=5, pool_maxsize=10)
    sess.mount("http://",  adapter)
    sess.mount("https://", adapter)
    return sess


def _text(element, tag: str) -> str:
    child = element.find(tag)
    return child.text.strip() if child is not None and child.text else ""


def _count_inventors(inventor_str: str) -> int:
    if not inventor_str:
        return 0
    for sep in [",", "|", ";"]:
        if sep in inventor_str:
            return len([x for x in inventor_str.split(sep) if x.strip()])
    return 1


def _parse_filed_at(application_date: str) -> date | None:
    if not application_date or len(application_date) != 8:
        return None
    try:
        return datetime.strptime(application_date, "%Y%m%d").date()
    except ValueError:
        return None


def fetch_patents_by_applicant(
    session: requests.Session,
    applicant_name: str,
    page: int = 1,
) -> list:
    res = session.get(
        f"{KIPRIS_BASE_URL}/getAdvancedSearch",
        params={
            "applicant":  applicant_name,
            "patent":     "true",
            "utility":    "false",
            "numOfRows":  500,
            "pageNo":     page,
            "ServiceKey": KIPRIS_API_KEY,
        },
        timeout=15,
    )
    res.raise_for_status()

    try:
        root = ET.fromstring(res.content)
    except ET.ParseError as e:
        logger.warning(f"XML 파싱 실패 ({applicant_name}): {e}")
        return []

    if root.findtext(".//successYN", "N") != "Y":
        msg = root.findtext(".//resultMsg", "")
        logger.warning(f"KIPRIS API 오류 ({applicant_name}): {msg}")
        return []

    items = root.findall(".//item")
    return [
        {
            "applicationNumber": _text(it, "applicationNumber"),
            "applicantName":     _text(it, "applicantName"),
            "ipcNumber":         _text(it, "ipcNumber"),
            "inventorName":      _text(it, "inventorName"),
            "applicationDate":   _text(it, "applicationDate"),
            "registerStatus":    _text(it, "registerStatus"),
        }
        for it in items
    ]


def fetch_and_save_patents(db: Session) -> int:
    """
    협력사(anchor=False) 전체 특허 수집.
    페이지 단위 IN 쿼리 dedup으로 N+1 제거, 월 호출 한도 카운터 가드.
    """
    if not KIPRIS_API_KEY:
        raise EnvironmentError("KIPRIS_API_KEY 환경변수가 설정되지 않았습니다.")

    suppliers = db.query(Company).filter(Company.is_anchor == False).all()
    if not suppliers:
        logger.warning("수집 대상 협력사가 없습니다.")
        return 0

    session   = _build_session()
    api_calls = 0
    count     = 0

    try:
        for company in suppliers:
            if api_calls >= KIPRIS_MONTHLY_QUOTA:
                logger.warning(f"KIPRIS 월 호출 한도({KIPRIS_MONTHLY_QUOTA}) 도달 — 중단")
                break

            page        = 1
            total_saved = 0

            while api_calls < KIPRIS_MONTHLY_QUOTA:
                try:
                    api_calls += 1
                    patents = fetch_patents_by_applicant(session, company.corp_name, page)
                    logger.info(
                        f"{company.corp_name} — 페이지 {page}, {len(patents)}건 "
                        f"(api_calls={api_calls}/{KIPRIS_MONTHLY_QUOTA})"
                    )

                    if not patents:
                        break

                    patent_nos = [p.get("applicationNumber") for p in patents if p.get("applicationNumber")]
                    existing = {
                        p for (p,) in db.query(Patent.patent_no)
                        .filter(Patent.patent_no.in_(patent_nos))
                        .all()
                    } if patent_nos else set()

                    new_rows = []
                    for p in patents:
                        patent_no = p.get("applicationNumber")
                        if not patent_no or patent_no in existing:
                            continue
                        existing.add(patent_no)

                        reg_status = p.get("registerStatus", "")
                        new_rows.append(Patent(
                            company_id=company.id,
                            patent_no=patent_no,
                            ipc_code=p.get("ipcNumber", "")[:20],
                            inventor_count=_count_inventors(p.get("inventorName", "")),
                            is_active=reg_status in ("등록", "존속"),
                            filed_at=_parse_filed_at(p.get("applicationDate", "")),
                        ))

                    if new_rows:
                        db.bulk_save_objects(new_rows)
                        db.commit()
                        total_saved += len(new_rows)
                        count       += len(new_rows)

                    if len(patents) < 500:
                        break
                    page += 1

                except Exception as e:
                    logger.warning(f"{company.corp_name} 페이지 {page} 실패: {e}")
                    db.rollback()
                    break

            logger.info(f"{company.corp_name} — 총 {total_saved}건 저장")

    finally:
        session.close()

    logger.info(f"KIPRIS 수집 완료 — {count}건, API 호출 {api_calls}회")
    return count
