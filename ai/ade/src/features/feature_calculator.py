"""
Phase 3 — D-Score 피처 계산기
파일 위치: src/features/feature_calculator.py

계산 피처:
  1. active_patents      — DB에서 직접 조회 (등록일 기준 최근 5년)
  2. ipc_entropy         — IPC 대분류 Shannon Entropy
  3. inventor_count_yoy  — KIPRIS 상세API (active patent만 호출) → 연도별 unique 발명자 YoY
  4. rd_ratio            — DART 재무: R&D비 / 매출액
                            1차: fnlttSinglAcntAll API (정형 계정)
                            2차: 사업보고서 원문 파싱 (1차 실패 시 보완)
  5. rd_growth           — DART 재무: R&D비 YoY 성장률 (rd_ratio와 동일 소스)
  6. op_margin_slope     — DART 재무: 영업이익률 선형회귀 기울기

KIPRIS API 키 운용:
  .env에 KIPRIS_API_KEY, KIPRIS_API_KEY_2 (선택)를 등록해두면,
  1번 키 호출 한도가 소진된 것으로 판단되는 순간 자동으로 2번 키로 전환된다.
  추가로 KIPRIS_API_KEY_3, _4 ... 도 같은 방식으로 인식한다 (KIPRIS_API_KEYS 참고).
"""

import os
import re
import json
import math
import time
import zipfile
import io
import logging
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

import requests
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# DB 연결
# ──────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


# ──────────────────────────────────────────────
# 피처 1 & 2 — patents 테이블에서 계산
# ──────────────────────────────────────────────

def get_patent_features(company_id: int) -> dict:
    """
    patents 테이블에서 active_patents 수와 IPC Entropy를 계산한다.
    ipc_code 컬럼은 TEXT로 저장된 JSON 배열 문자열.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                "SELECT ipc_code, is_active FROM patents WHERE company_id = %s",
                (company_id,)
            )
            rows = cur.fetchall()

    active_count = 0
    all_ipc: list[str] = []

    for row in rows:
        if row["is_active"]:
            active_count += 1

        raw = row["ipc_code"]
        if not raw:
            continue
        try:
            codes = json.loads(raw) if isinstance(raw, str) else raw
            if isinstance(codes, list):
                all_ipc.extend(codes)
        except (json.JSONDecodeError, TypeError):
            all_ipc.append(str(raw))

    entropy = _ipc_entropy(all_ipc)
    logger.info(
        f"[company_id={company_id}] active_patents={active_count}, "
        f"ipc_codes={len(all_ipc)}, ipc_entropy={entropy:.4f}"
    )
    return {"active_patents": active_count, "ipc_entropy": entropy}


def _ipc_entropy(ipc_list: list[str]) -> float:
    """IPC 대분류(첫 4자) 기준 Shannon Entropy. 예: 'H01L 21/205' → 'H01L'"""
    if not ipc_list:
        return 0.0
    major = [c.split("/")[0][:4].strip() for c in ipc_list]
    counts = Counter(major)
    total = sum(counts.values())
    return -sum((v / total) * math.log2(v / total) for v in counts.values())


# ──────────────────────────────────────────────
# KIPRIS API 키 풀 — 한도 소진 시 자동 전환
# ──────────────────────────────────────────────

KIPRIS_BASE = "http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice"


def _load_kipris_keys() -> list[str]:
    """
    .env에서 KIPRIS_API_KEY, KIPRIS_API_KEY_2, _3 ... 순서대로 전부 로드.
    하나라도 비어있지 않으면 리스트에 포함.
    """
    keys = []
    primary = os.getenv("KIPRIS_API_KEY")
    if primary:
        keys.append(primary)

    i = 2
    while True:
        k = os.getenv(f"KIPRIS_API_KEY_{i}")
        if not k:
            break
        keys.append(k)
        i += 1

    if not keys:
        logger.error("KIPRIS_API_KEY가 .env에 하나도 없습니다.")
    return keys


class KiprisKeyPool:
    """
    여러 개의 KIPRIS API 키를 순서대로 관리한다.
    현재 키 호출이 실패(빈 응답 포함)하면 다음 키로 자동 전환한다.
    한 번 소진된 것으로 판단된 키는 같은 실행 동안 다시 시도하지 않는다.
    """

    def __init__(self, keys: list[str] = None):
        self.keys = keys or _load_kipris_keys()
        self.current_index = 0
        self.exhausted = set()  # 소진된 것으로 판단된 키 인덱스

    @property
    def current_key(self) -> str | None:
        if self.current_index >= len(self.keys):
            return None
        return self.keys[self.current_index]

    def mark_exhausted(self):
        """현재 키를 소진 처리하고 다음 키로 넘어간다."""
        if self.current_index < len(self.keys):
            logger.warning(
                f"  [KIPRIS 키 전환] {self.current_index + 1}번 키 한도 소진 추정 → "
                f"{self.current_index + 2}번 키로 전환 시도"
            )
        self.exhausted.add(self.current_index)
        self.current_index += 1

    def has_key(self) -> bool:
        return self.current_key is not None


def _request_bibliography(application_number: str, api_key: str) -> tuple[bool, list[str]]:
    """
    KIPRIS 서지정보 상세 API 단발 호출.
    반환: (성공여부, 발명자명 리스트)
    성공여부=False는 "이 키로는 더 이상 데이터를 못 받는 상태(한도 소진 추정)"를 의미.
    발명자가 0명인 정상 케이스(원래 발명자 정보가 비어있는 특허)와 구분하기 위해,
    resultCode가 정상인데 biblioSummaryInfo 자체가 없으면 실패로 간주한다.
    """
    url = f"{KIPRIS_BASE}/getBibliographyDetailInfoSearch"
    params = {"applicationNumber": application_number, "ServiceKey": api_key}

    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.warning(f"  [요청 실패] {application_number}: {e}")
        return False, []

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError:
        return False, []

    result_code = root.findtext(".//resultCode", "")
    if result_code != "00":
        return False, []

    # 핵심 판단: 서지정보 자체가 비어있으면 한도 소진으로 추정 (정상 응답인데 알맹이가 없는 패턴)
    has_biblio = root.find(".//biblioSummaryInfo") is not None
    names = [
        inv.findtext("name", "").strip()
        for inv in root.iter("inventorInfo")
    ]
    names = [n for n in names if n]

    if not has_biblio:
        return False, []

    return True, names


def fetch_inventors_with_failover(application_number: str, key_pool: KiprisKeyPool) -> list[str]:
    """
    키 풀을 사용해 발명자명을 조회한다.
    현재 키로 실패하면 자동으로 다음 키로 전환해서 같은 요청을 재시도한다.
    모든 키가 소진되면 빈 리스트를 반환한다.
    """
    while key_pool.has_key():
        key = key_pool.current_key
        ok, names = _request_bibliography(application_number, key)
        if ok:
            return names
        # 실패 → 이 키는 소진된 것으로 보고 다음 키로 전환 후 같은 특허 재시도
        key_pool.mark_exhausted()

    logger.error(f"  [전체 키 소진] {application_number} 발명자 조회 실패 (모든 키 사용 불가)")
    return []


# ──────────────────────────────────────────────
# 피처 3 — inventor_count_yoy
# ──────────────────────────────────────────────

def _get_active_patent_numbers(company_id: int) -> list[dict]:
    """
    patents 테이블에서 is_active=True(최근 5년 등록)인 특허의 patent_no, filed_at을 가져온다.
    patent_no는 kipris_collector.py에서 출원번호로 통일 저장하므로 변환 없이 그대로 사용한다.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                SELECT patent_no, filed_at
                FROM patents
                WHERE company_id = %s AND is_active = TRUE
                """,
                (company_id,)
            )
            rows = cur.fetchall()
    return [{"patent_no": r["patent_no"], "filed_at": r["filed_at"]} for r in rows]


def get_inventor_yoy(company_id: int, key_pool: KiprisKeyPool, sleep_sec: float = 0.3) -> float:
    """
    active patent(최근 5년 등록)만 대상으로 KIPRIS 상세API를 호출해
    연도별 unique 발명자 수를 계산하고 YoY 증감률을 반환한다.

    비교 대상 연도는 "완전히 끝난 연도" 중 최근 2개로 고정한다.
    (진행 중인 올해는 데이터가 미완성이라 비교에서 제외)

    YoY = (최신연도 unique발명자수 - 직전연도 unique발명자수) / 직전연도 unique발명자수
    """
    patents = _get_active_patent_numbers(company_id)
    if not patents:
        logger.warning(f"[company_id={company_id}] active patent 없음 → inventor_count_yoy=0")
        return 0.0

    logger.info(f"[company_id={company_id}] 발명자 조회 시작 — active patent {len(patents)}건")

    year_inventors: dict[int, set] = defaultdict(set)
    current_year = __import__("datetime").date.today().year

    for i, p in enumerate(patents):
        if not p["filed_at"]:
            continue
        if not key_pool.has_key():
            logger.error(f"[company_id={company_id}] 키 전부 소진, 발명자 조회 중단 ({i}/{len(patents)}건 처리)")
            break

        year = p["filed_at"].year
        inventors = fetch_inventors_with_failover(p["patent_no"], key_pool)
        year_inventors[year].update(inventors)

        if (i + 1) % 50 == 0:
            logger.info(f"  진행: {i+1}/{len(patents)}건")
        time.sleep(sleep_sec)

    # 진행 중인 올해는 미완성 데이터라 비교 대상에서 제외
    complete_years = sorted(y for y in year_inventors.keys() if y < current_year)
    if len(complete_years) < 2:
        logger.warning(
            f"[company_id={company_id}] 완전한 연도 데이터 부족(연도 수={len(complete_years)}) "
            f"→ inventor_count_yoy=0"
        )
        return 0.0

    prev_year, cur_year = complete_years[-2], complete_years[-1]
    prev_count = len(year_inventors[prev_year])
    cur_count = len(year_inventors[cur_year])

    yoy = (cur_count - prev_count) / prev_count if prev_count > 0 else 0.0

    logger.info(
        f"[company_id={company_id}] 발명자 수 — {prev_year}년: {prev_count}명, "
        f"{cur_year}년: {cur_count}명, YoY={yoy:.4f}"
    )
    return yoy


# ──────────────────────────────────────────────
# 피처 4, 5, 6 — DART 재무데이터
# ──────────────────────────────────────────────

DART_BASE = "https://opendart.fss.or.kr/api"

ACCOUNT_MAP = {
    "revenue":    ["매출액", "수익(매출액)"],
    "rd_expense": ["연구개발비", "경상연구개발비", "연구비", "연구개발비용", "연구와 개발 비용"],
    "op_income":  ["영업이익", "영업이익(손실)"],
}

# companies 테이블의 corp_code(DART 고유번호) 매핑
# TODO: companies 테이블에 dart_corp_code 컬럼 추가 후 DB 조회로 전환
DART_CORP_CODES: dict[int, str] = {
    1: "00126380",   # 삼성전자
    2: "00164779",   # SK하이닉스
    3: "01365825",   # 피에스케이
    4: "00468374",   # 원익QnC
    5: "00161383",   # 한미반도체
    6: "01489648",   # 솔브레인
    7: "00244747",   # 파크시스템스
}

# 사업보고서 원문에서 R&D 비율을 찾을 때 시도할 키워드 후보 (회사마다 표기 다름)
RD_RATIO_KEYWORDS = [
    "연구개발비 / 매출액 비율",
    "연구개발비/매출액 비율",
    "매출액 대비 비율",
    "연구개발비용 / 매출액 비율",
]


def _dart_financial(corp_code: str, bsns_year: str, reprt_code: str = "11011") -> dict:
    """DART 단일회사 주요계정 API 호출 (1차 소스 — 정형 재무제표)."""
    params = {
        "crtfc_key": os.getenv("DART_API_KEY"),
        "corp_code": corp_code,
        "bsns_year": bsns_year,
        "reprt_code": reprt_code,
        "fs_div": "CFS",
    }
    resp = requests.get(f"{DART_BASE}/fnlttSinglAcntAll.json", params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if data.get("status") != "000":
        logger.warning(f"DART API 오류: {data.get('status')} / {data.get('message')}")
        return {}

    result = {}
    for item in data.get("list", []):
        acnt_nm = item.get("account_nm", "")
        try:
            amount = float(str(item.get("thstrm_amount", "0")).replace(",", ""))
        except (ValueError, TypeError):
            amount = 0.0
        result[acnt_nm] = amount
    return result


def _pick_account(financial: dict, candidates: list[str]) -> float:
    for key in candidates:
        if key in financial:
            return financial[key]
    return 0.0


def _find_latest_report_rcept_no(corp_code: str, year: int) -> str | None:
    """사업보고서(pblntf_ty=A) 접수번호 검색 (다음해 1~6월 범위)."""
    params = {
        "crtfc_key": os.getenv("DART_API_KEY"),
        "corp_code": corp_code,
        "bgn_de": f"{year + 1}0101",
        "end_de": f"{year + 1}0630",
        "pblntf_ty": "A",
    }
    try:
        resp = requests.get(f"{DART_BASE}/list.json", params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning(f"사업보고서 목록 조회 실패: {e}")
        return None

    for item in data.get("list", []):
        if "사업보고서" in item.get("report_nm", ""):
            return item.get("rcept_no")
    return None


def _fetch_document_xml(rcept_no: str) -> str | None:
    """사업보고서 원문(zip) 다운로드 → 가장 큰 xml 파일 텍스트 반환."""
    try:
        resp = requests.get(
            f"{DART_BASE}/document.xml",
            params={"crtfc_key": os.getenv("DART_API_KEY"), "rcept_no": rcept_no},
            timeout=20,
        )
        resp.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(resp.content)) as z:
            sizes = [(name, z.getinfo(name).file_size) for name in z.namelist()]
            sizes.sort(key=lambda x: -x[1])
            main_file = sizes[0][0]
            with z.open(main_file) as f:
                return f.read().decode("utf-8")
    except Exception as e:
        logger.warning(f"사업보고서 원문 다운로드 실패 (rcept_no={rcept_no}): {e}")
        return None


def _parse_rd_ratio_from_text(content: str) -> list[float]:
    """사업보고서 원문에서 R&D비율 표를 찾아 [당기, 전기, 전전기] % 반환."""
    for keyword in RD_RATIO_KEYWORDS:
        idx = content.find(keyword)
        if idx == -1:
            continue
        window = content[idx:idx + 1500]
        cell_end = re.search(r"</T[DH]>", window)
        start = cell_end.end() if cell_end else 0
        search_zone = window[start:start + 800]
        matches = re.findall(r"<T[DH][^>]*>\s*([\d]+\.?[\d]*)\s*%?\s*</T[DH]>", search_zone)
        clean = [float(m) for m in matches if m and re.match(r"^[\d.]+$", m)]
        if clean:
            return clean[:3]
    return []


def get_rd_ratio_from_report(company_id: int, years: list[int]) -> list[float]:
    """fnlttSinglAcntAll에서 못 찾은 R&D비율을 사업보고서 원문 파싱으로 보완."""
    corp_code = DART_CORP_CODES.get(company_id)
    if not corp_code:
        return []
    latest_year = max(years)
    rcept_no = _find_latest_report_rcept_no(corp_code, latest_year)
    if not rcept_no:
        logger.warning(f"[company_id={company_id}] {latest_year}년 사업보고서 못 찾음")
        return []
    content = _fetch_document_xml(rcept_no)
    if not content:
        return []
    ratios = _parse_rd_ratio_from_text(content)
    logger.info(f"[company_id={company_id}] 사업보고서 파싱 R&D비율: {ratios}")
    return ratios


def get_dart_features(company_id: int, years: list[int] = None) -> dict:
    """
    DART 재무데이터로 rd_ratio, rd_growth, op_margin_slope 계산.

    rd_ratio/rd_growth 처리 순서:
      1차: fnlttSinglAcntAll API에서 '연구개발비' 계정 직접 조회
      2차: 1차가 0이면 사업보고서 원문 파싱으로 R&D비율(%) 직접 사용

    years: 최근 3개 연도 기본값 [2023, 2024, 2025]
    """
    if years is None:
        years = [2023, 2024, 2025]

    corp_code = DART_CORP_CODES.get(company_id)
    if not corp_code:
        logger.error(f"[company_id={company_id}] DART corp_code 없음")
        return {"rd_ratio": 0.0, "rd_growth": 0.0, "op_margin_slope": 0.0, "rd_source": "none"}

    yearly: dict[int, dict] = {}
    for yr in years:
        try:
            fin = _dart_financial(corp_code, str(yr))
            yearly[yr] = {
                "revenue":    _pick_account(fin, ACCOUNT_MAP["revenue"]),
                "rd_expense": _pick_account(fin, ACCOUNT_MAP["rd_expense"]),
                "op_income":  _pick_account(fin, ACCOUNT_MAP["op_income"]),
            }
            logger.info(f"[company_id={company_id}] {yr}년 재무: {yearly[yr]}")
        except Exception as e:
            logger.warning(f"[company_id={company_id}] {yr}년 DART 수집 실패: {e}")
            yearly[yr] = {"revenue": 0.0, "rd_expense": 0.0, "op_income": 0.0}

    sorted_yrs = sorted(years)
    latest_yr = max(years)

    latest = yearly[latest_yr]
    rd_ratio = latest["rd_expense"] / latest["revenue"] if latest["revenue"] > 0 else 0.0

    if len(sorted_yrs) >= 2:
        prev_yr, cur_yr = sorted_yrs[-2], sorted_yrs[-1]
        prev_rd, cur_rd = yearly[prev_yr]["rd_expense"], yearly[cur_yr]["rd_expense"]
        rd_growth = (cur_rd - prev_rd) / prev_rd if prev_rd > 0 else 0.0
    else:
        rd_growth = 0.0

    used_fallback = False
    if rd_ratio == 0.0:
        ratios_pct = get_rd_ratio_from_report(company_id, years)
        if len(ratios_pct) >= 1:
            rd_ratio = ratios_pct[0] / 100.0
            used_fallback = True
        if len(ratios_pct) >= 2:
            prev_pct, cur_pct = ratios_pct[1], ratios_pct[0]
            rd_growth = (cur_pct - prev_pct) / prev_pct if prev_pct > 0 else 0.0

    if used_fallback:
        logger.info(f"[company_id={company_id}] rd_ratio/rd_growth는 사업보고서 원문 파싱으로 보완됨")

    op_margins = []
    for yr in sorted_yrs:
        rev, opi = yearly[yr]["revenue"], yearly[yr]["op_income"]
        op_margins.append(opi / rev if rev > 0 else 0.0)
    op_margin_slope = _linear_slope(op_margins)

    logger.info(
        f"[company_id={company_id}] rd_ratio={rd_ratio:.4f}, "
        f"rd_growth={rd_growth:.4f}, op_margin_slope={op_margin_slope:.6f}, "
        f"fallback_used={used_fallback}"
    )
    return {
        "rd_ratio":        rd_ratio,
        "rd_growth":       rd_growth,
        "op_margin_slope": op_margin_slope,
        "rd_source":       "report_parsing" if used_fallback else "dart_api",
    }


def _linear_slope(values: list[float]) -> float:
    """등간격 시계열의 선형회귀 기울기 (최소제곱법)."""
    n = len(values)
    if n < 2:
        return 0.0
    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    num = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    denom = sum((i - x_mean) ** 2 for i in range(n))
    return num / denom if denom != 0 else 0.0


# ──────────────────────────────────────────────
# 통합 피처 수집
# ──────────────────────────────────────────────

def compute_features(company_id: int, key_pool: KiprisKeyPool) -> dict:
    """
    company_id 하나에 대해 D-Score 피처 전체를 계산하고 dict 반환.
    key_pool은 여러 기업 계산에 걸쳐 공유되며, 키 소진 상태도 함께 유지된다.
    """
    logger.info(f"=== [company_id={company_id}] 피처 계산 시작 ===")

    patent_feat = get_patent_features(company_id)
    inventor_yoy = get_inventor_yoy(company_id, key_pool)
    dart_feat = get_dart_features(company_id)

    features = {
        "company_id":         company_id,
        "active_patents":     patent_feat["active_patents"],
        "ipc_entropy":        patent_feat["ipc_entropy"],
        "inventor_count_yoy": inventor_yoy,
        "rd_ratio":           dart_feat["rd_ratio"],
        "rd_growth":          dart_feat["rd_growth"],
        "op_margin_slope":    dart_feat["op_margin_slope"],
        "rd_source":          dart_feat.get("rd_source", "dart_api"),
    }
    logger.info(f"=== [company_id={company_id}] 피처 계산 완료: {features} ===")
    return features


def compute_all_features(company_ids: list[int] = None) -> list[dict]:
    """
    전체(또는 지정) 기업 피처 계산.
    기본값: companies 테이블에 있는 3~7번 (협력사 5개사)

    KIPRIS 키 풀(KiprisKeyPool)을 기업 계산 전체에 걸쳐 하나만 생성해 공유한다.
    한 기업 처리 중 키가 소진되면, 다음 기업 처리에서도 이미 소진된 키는 건너뛰고
    이어서 사용 가능한 키부터 시도한다.
    """
    if company_ids is None:
        company_ids = [3, 4, 5, 6, 7]

    key_pool = KiprisKeyPool()
    logger.info(f"KIPRIS API 키 {len(key_pool.keys)}개 로드됨")

    results = []
    for cid in company_ids:
        try:
            results.append(compute_features(cid, key_pool))
        except Exception as e:
            logger.error(f"[company_id={cid}] 피처 계산 중 오류: {e}")

    return results


# ──────────────────────────────────────────────
# 단독 실행 테스트
# ──────────────────────────────────────────────

if __name__ == "__main__":
    all_features = compute_all_features()
    for f in all_features:
        print(f)