import os
import logging
from datetime import date, datetime, timedelta

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from sqlalchemy.orm import Session

from models import Company, Disclosure

logger = logging.getLogger("batch.dart")

DART_API_KEY  = os.getenv("DART_API_KEY", "")
DART_BASE_URL = "https://opendart.fss.or.kr/api"

ANCHOR_CORP_CODES = {
    "00126380": "삼성전자",
    "00164779": "SK하이닉스",
}


def _build_session() -> requests.Session:
    """connection pool + Retry."""
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


def _parse_rcept_dt(rcept_dt: str) -> date:
    try:
        return datetime.strptime(rcept_dt, "%Y%m%d").date()
    except (TypeError, ValueError):
        return date.today()


def fetch_disclosures_by_corp(
    session: requests.Session,
    corp_code: str,
    bgn_de:    str,
    end_de:    str,
) -> list:
    res = session.get(
        f"{DART_BASE_URL}/list.json",
        params={
            "crtfc_key":  DART_API_KEY,
            "corp_code":  corp_code,
            "bgn_de":     bgn_de,
            "end_de":     end_de,
            "page_count": 100,
        },
        timeout=10,
    )
    res.raise_for_status()
    data = res.json()

    if data.get("status") != "000":
        logger.warning(f"DART API 응답: {data.get('message')}")
        return []

    return data.get("list", [])


def fetch_and_save_disclosures(db: Session, days: int = 90) -> int:
    """
    최근 N일 공시 수집 (기본 90일).
    원문(content)은 AI-A의 BGE-M3 파이프라인에서 별도 채움.
    rcept_no IN 한 번으로 dedup → N+1 제거.
    """
    if not DART_API_KEY:
        raise EnvironmentError("DART_API_KEY 환경변수가 설정되지 않았습니다.")

    end_de = date.today().strftime("%Y%m%d")
    bgn_de = (date.today() - timedelta(days=days)).strftime("%Y%m%d")
    count  = 0

    logger.info(f"DART 수집 기간: {bgn_de} ~ {end_de}")

    session = _build_session()
    try:
        for corp_code, corp_name in ANCHOR_CORP_CODES.items():
            try:
                company = db.query(Company).filter(Company.corp_code == corp_code).first()
                if not company:
                    company = Company(
                        corp_code=corp_code,
                        corp_name=corp_name,
                        is_listed=True,
                        is_anchor=True,
                        sector="반도체",
                    )
                    db.add(company)
                    db.flush()

                disclosures = fetch_disclosures_by_corp(session, corp_code, bgn_de, end_de)
                logger.info(f"{corp_name} — 공시 {len(disclosures)}건")
                if not disclosures:
                    continue

                rcept_nos = [d.get("rcept_no") for d in disclosures if d.get("rcept_no")]
                existing = {
                    r for (r,) in db.query(Disclosure.rcept_no)
                    .filter(Disclosure.rcept_no.in_(rcept_nos))
                    .all()
                } if rcept_nos else set()

                new_rows = []
                for item in disclosures:
                    rcept_no = item.get("rcept_no")
                    if not rcept_no or rcept_no in existing:
                        continue
                    existing.add(rcept_no)

                    new_rows.append(Disclosure(
                        company_id=company.id,
                        rcept_no=rcept_no,
                        title=item.get("report_nm"),
                        content=None,
                        embedding=None,
                        signal_score=None,
                        disclosed_at=_parse_rcept_dt(item.get("rcept_dt", "")),
                    ))

                if new_rows:
                    db.bulk_save_objects(new_rows)
                    db.commit()
                    count += len(new_rows)

            except Exception as e:
                logger.error(f"{corp_name} 수집 실패: {e}")
                db.rollback()
                continue

    finally:
        session.close()

    return count
