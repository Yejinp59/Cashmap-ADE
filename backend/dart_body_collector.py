"""
DART 원문(본문) 수집기 — document.xml 다운로드 → 파싱 → disclosures(청크) 적재.

- 팀원 Supabase 스키마에 맞춤: corp_code/corp_name/rcept_no/report_type/rcept_dt/
  section_title/chunk_index/raw_text/token_count.
- 기존 rcept_no(AI-A가 적재한 신호 공시 포함)는 건너뜀 → 중복/혼선 방지.
- DART document.xml 특이점: ZIP 안의 .xml 이 선언과 달리 EUC-KR 인코딩, &cr; 등 커스텀 엔티티,
  본문은 <TITLE> 섹션 + <P> 단락 + <TABLE>(숫자표) 구조. 표는 "[표 생략]" 으로 대체.

사용:
    from database import SessionLocal
    from dart_body_collector import collect_bodies
    collect_bodies(SessionLocal(), days=400, max_docs_per_corp=3)
"""
import os
import re
import io
import zipfile
import logging
from datetime import date, datetime, timedelta

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from sqlalchemy.orm import Session

from models import Company, Disclosure

logger = logging.getLogger("batch.dart_body")

DART_API_KEY = os.getenv("DART_API_KEY", "")
BASE_URL = "https://opendart.fss.or.kr/api"

ANCHOR_CORPS = {
    "00126380": "삼성전자",
    "00164779": "SK하이닉스",
}
PERIODIC_KEYWORDS = ("분기보고서", "반기보고서", "사업보고서")

_ENTITIES = [
    ("&cr;", " "), ("&nbsp;", " "), ("&amp;", "&"),
    ("&lt;", "<"), ("&gt;", ">"), ("&apos;", "'"), ("&quot;", '"'),
]


def _build_session() -> requests.Session:
    sess = requests.Session()
    retry = Retry(
        total=3, backoff_factor=0.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset(["GET"]), raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=5, pool_maxsize=10)
    sess.mount("https://", adapter)
    sess.mount("http://", adapter)
    return sess


def _parse_dt(s: str) -> date:
    try:
        return datetime.strptime((s or "").strip(), "%Y%m%d").date()
    except (TypeError, ValueError):
        return date.today()


def fetch_list(session: requests.Session, corp_code: str, bgn_de: str, end_de: str) -> list:
    """기간 내 공시 목록(메타) — rcept_no/report_nm/rcept_dt."""
    res = session.get(
        f"{BASE_URL}/list.json",
        params={
            "crtfc_key": DART_API_KEY, "corp_code": corp_code,
            "bgn_de": bgn_de, "end_de": end_de, "page_count": 100,
        },
        timeout=15,
    )
    res.raise_for_status()
    data = res.json()
    if data.get("status") != "000":
        logger.warning("DART list 응답: %s", data.get("message"))
        return []
    return data.get("list", [])


def fetch_document(session: requests.Session, rcept_no: str) -> str | None:
    """document.xml(zip) 다운로드 → 내부 .xml 디코드(euc-kr)."""
    res = session.get(
        f"{BASE_URL}/document.xml",
        params={"crtfc_key": DART_API_KEY, "rcept_no": rcept_no},
        timeout=40,
    )
    if res.content[:2] != b"PK":   # ZIP 시그니처 아니면 에러 HTML
        logger.warning("document.xml 비정상 응답 (rcept_no=%s)", rcept_no)
        return None
    try:
        z = zipfile.ZipFile(io.BytesIO(res.content))
        raw = z.read(z.namelist()[0])
    except (zipfile.BadZipFile, IndexError) as e:
        logger.warning("document.xml unzip 실패 (rcept_no=%s): %s", rcept_no, e)
        return None
    for enc in ("euc-kr", "cp949", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("euc-kr", "replace")


def _clean(text: str) -> str:
    for a, b in _ENTITIES:
        text = text.replace(a, b)
    text = re.sub(r"(?s)<[^>]+>", " ", text)      # 태그 제거
    text = text.replace("　", " ")            # 전각 공백
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"(\[표 생략\]\s*){2,}", "[표 생략] ", text)
    # 항목 표지(가./나./1.) 앞에서만 단락 구분
    text = re.sub(r"\s+(?=(?:[가나다라마바사아자차카타파하]\.|\d{1,2}\.)\s)", "\n\n", text)
    return text.strip()


def parse_sections(xml: str) -> list[tuple[str, str]]:
    """DART 문서 XML → [(섹션제목, 본문)] (표는 [표 생략])."""
    m = re.search(r"(?s)<BODY>(.*)</BODY>", xml)
    body = m.group(1) if m else xml
    body = re.sub(r"(?s)<TABLE\b.*?</TABLE>", " [표 생략] ", body)
    titles = list(re.finditer(r"(?s)<TITLE\b[^>]*>(.*?)</TITLE>", body))
    sections = []
    if not titles:
        whole = _clean(body)
        return [("(본문)", whole)] if len(whole) > 15 else []
    for i, t in enumerate(titles):
        title = _clean(t.group(1))[:120] or "(제목 없음)"
        start = t.end()
        end = titles[i + 1].start() if i + 1 < len(titles) else len(body)
        text = _clean(body[start:end])
        if len(text) > 15:
            sections.append((title, text))
    return sections


def _chunk_sections(
    sections: list[tuple[str, str]], max_chars: int = 1500, max_chunks: int = 80,
) -> list[tuple[str, int, str]]:
    """섹션을 길이 기준으로 잘라 (section_title, chunk_index, text) 리스트로."""
    out: list[tuple[str, int, str]] = []
    idx = 0
    for title, text in sections:
        for i in range(0, len(text), max_chars):
            out.append((title, idx, text[i:i + max_chars]))
            idx += 1
            if idx >= max_chunks:
                return out
    return out


def collect_bodies(
    db: Session,
    corp_codes: dict | None = None,
    days: int = 400,
    max_docs_per_corp: int = 3,
    only_periodic: bool = True,
) -> dict:
    """앵커 기업의 최근 공시 본문을 수집해 disclosures 에 청크로 적재."""
    if not DART_API_KEY:
        raise EnvironmentError("DART_API_KEY 가 설정되지 않았습니다.")

    corps = corp_codes or ANCHOR_CORPS
    end_de = date.today().strftime("%Y%m%d")
    bgn_de = (date.today() - timedelta(days=days)).strftime("%Y%m%d")
    session = _build_session()
    result = {"docs": 0, "chunks": 0, "skipped": 0, "per_corp": {}}

    try:
        for corp_code, corp_name in corps.items():
            company = db.query(Company).filter(Company.corp_code == corp_code).first()
            name = company.corp_name if company else corp_name

            items = fetch_list(session, corp_code, bgn_de, end_de)
            if only_periodic:
                items = [it for it in items
                         if any(k in (it.get("report_nm") or "") for k in PERIODIC_KEYWORDS)]
            items.sort(key=lambda it: it.get("rcept_dt", ""), reverse=True)

            taken = 0
            for it in items:
                if taken >= max_docs_per_corp:
                    break
                rcept_no = it.get("rcept_no")
                if not rcept_no:
                    continue
                # 기존(AI-A 포함) rcept_no 건너뜀
                exists = db.query(Disclosure.id).filter(Disclosure.rcept_no == rcept_no).first()
                if exists:
                    result["skipped"] += 1
                    continue

                xml = fetch_document(session, rcept_no)
                if not xml:
                    continue
                chunks = _chunk_sections(parse_sections(xml))
                if not chunks:
                    continue

                report_nm = (it.get("report_nm") or "").strip()
                rcept_dt = _parse_dt(it.get("rcept_dt", ""))
                rows = [
                    Disclosure(
                        corp_code=corp_code, corp_name=name, rcept_no=rcept_no,
                        report_type=report_nm, rcept_dt=rcept_dt,
                        section_title=sec_title, chunk_index=ci,
                        raw_text=text, token_count=len(text.split()),
                    )
                    for sec_title, ci, text in chunks
                ]
                db.bulk_save_objects(rows)
                db.commit()
                result["docs"] += 1
                result["chunks"] += len(rows)
                result["per_corp"].setdefault(name, 0)
                result["per_corp"][name] += 1
                taken += 1
                logger.info("적재: %s %s (%d청크)", name, report_nm, len(rows))
    finally:
        session.close()

    return result
