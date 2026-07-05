"""
KIPRIS 특허 데이터 수집 모듈 (v2 — 개별 특허 저장)
- 기업별 특허 전체 수집 (페이지네이션 자동 처리)
- 특허를 개별 레코드로 DB 저장 (기존: 회사당 요약 1건 → 변경: 특허 1건씩)
- active_patents = 등록일 기준 최근 5년 이내 등록된 특허 수
- ipc_codes, joint_patent_count 추출
"""

import os
import json
import time
import requests
import xml.etree.ElementTree as ET
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from datetime import datetime, date

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'normalizer'))
from normalizer import CompanyNormalizer

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

KIPRIS_API_KEY = os.getenv("KIPRIS_API_KEY")
DATABASE_URL   = os.getenv("DATABASE_URL")

KIPRIS_BASE_URL = (
    "http://plus.kipris.or.kr/kipo-api/kipi/"
    "patUtiModInfoSearchSevice/getAdvancedSearch"
)

# 최근 5년 기준 연도 (등록일 필터)
ACTIVE_YEARS = 5


# -------------------------------------------------------
# 1. KIPRIS API 호출 (변경 없음)
# -------------------------------------------------------

def fetch_patents_page(applicant: str, page: int, num_of_rows: int = 100) -> dict:
    params = {
        "applicant"   : applicant,
        "ServiceKey"  : KIPRIS_API_KEY,
        "numOfRows"   : num_of_rows,
        "pageNo"      : page,
    }
    try:
        response = requests.get(KIPRIS_BASE_URL, params=params, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"  [오류] API 요청 실패 (page {page}): {e}")
        return {"items": [], "total_count": 0}

    try:
        root = ET.fromstring(response.text)
    except ET.ParseError as e:
        print(f"  [오류] XML 파싱 실패: {e}")
        return {"items": [], "total_count": 0}

    result_code = root.findtext(".//resultCode", "")
    if result_code != "00":
        result_msg = root.findtext(".//resultMsg", "")
        print(f"  [오류] KIPRIS 응답 오류: {result_code} - {result_msg}")
        return {"items": [], "total_count": 0}

    total_count = int(root.findtext(".//totalCount", "0"))

    items = []
    for item in root.findall(".//item"):
        items.append({
            "applicant_name"  : item.findtext("applicantName", ""),
            "application_no"  : item.findtext("applicationNumber", ""),
            "application_date": item.findtext("applicationDate", ""),
            "register_no"     : item.findtext("registerNumber", ""),
            "register_date"   : item.findtext("registerDate", ""),
            "register_status" : item.findtext("registerStatus", ""),
            "ipc_number"      : item.findtext("ipcNumber", ""),
            "invention_title" : item.findtext("inventionTitle", ""),
        })

    return {"items": items, "total_count": total_count}


def fetch_all_patents(kipris_search_name: str) -> list:
    print(f"\n  '{kipris_search_name}' 특허 수집 시작...")
    first = fetch_patents_page(kipris_search_name, page=1)
    total = first["total_count"]
    print(f"  전체 특허 수: {total}건")

    if total == 0:
        return []

    all_items = first["items"]
    total_pages = (total + 99) // 100

    for page in range(2, total_pages + 1):
        print(f"  페이지 {page}/{total_pages} 수집 중...")
        result = fetch_patents_page(kipris_search_name, page=page)
        all_items.extend(result["items"])
        time.sleep(0.3)

    print(f"  수집 완료: {len(all_items)}건")
    return all_items


# -------------------------------------------------------
# 2. 날짜 파싱 헬퍼
# -------------------------------------------------------

def parse_kipris_date(date_str: str) -> date | None:
    """
    KIPRIS 날짜 형식 파싱.
    형식: "20210315" → date(2021, 3, 15)
    """
    if not date_str or len(date_str) != 8:
        return None
    try:
        return datetime.strptime(date_str, "%Y%m%d").date()
    except ValueError:
        return None


def is_active_patent(register_date_str: str, years: int = ACTIVE_YEARS) -> bool:
    """
    등록일 기준 최근 N년 이내인지 확인.
    등록일이 없으면 False 반환.
    """
    reg_date = parse_kipris_date(register_date_str)
    if reg_date is None:
        return False
    cutoff = date(date.today().year - years, date.today().month, date.today().day)
    return reg_date >= cutoff


# -------------------------------------------------------
# 3. 수집 데이터 분석 + 개별 특허 레코드 생성
# -------------------------------------------------------

def analyze_patents(
    all_items: list,
    target_normalized: str,
    normalizer: CompanyNormalizer
) -> dict:
    """
    수집한 특허 목록에서 D-Score 피처 계산에 필요한 값 추출.

    변경사항:
    - active_patents: 등록일 기준 최근 5년 이내 등록된 특허 수
    - patent_records: 개별 특허 레코드 리스트 (DB 저장용)

    반환값:
    {
        "active_patents"     : 최근 5년 등록 특허 수,
        "total_patents"      : 전체 유효 특허 수,
        "joint_patent_count" : SK하이닉스 공동출원 수,
        "ipc_codes"          : 전체 IPC 코드 리스트,
        "inventor_count"     : 0 (KIPRIS 상세API 미연동),
        "patent_records"     : 개별 특허 레코드 리스트,
    }
    """
    active_patents     = 0
    joint_patent_count = 0
    all_ipc_codes      = []
    valid_count        = 0
    patent_records     = []  # 개별 특허 저장용

    for item in all_items:
        raw_applicants = item["applicant_name"]
        applicant_list = [a.strip() for a in raw_applicants.split("|")]
        normalized_list = [normalizer.normalize(a) for a in applicant_list]

        # 타겟 기업이 출원인에 포함되어 있는지 확인
        if target_normalized not in normalized_list:
            continue

        valid_count += 1

        # IPC 코드 파싱
        ipc_list = []
        if item["ipc_number"]:
            ipc_list = [c.strip() for c in item["ipc_number"].split("|") if c.strip()]
            all_ipc_codes.extend(ipc_list)

        # 등록일 기준 최근 5년 이내 여부
        is_active = (
            item["register_status"] == "등록"
            and is_active_patent(item["register_date"])
        )
        if is_active:
            active_patents += 1

        # SK하이닉스 공동출원 확인
        if "SK하이닉스" in normalized_list:
            joint_patent_count += 1

        # 등록일 파싱
        reg_date = parse_kipris_date(item["register_date"])
        app_date = parse_kipris_date(item["application_date"])

        # 개별 특허 레코드 생성
        patent_records.append({
            "patent_no"     : item["application_no"],
            "ipc_code"      : json.dumps(ipc_list, ensure_ascii=False),
            "inventor_count": 0,       # KIPRIS 상세API 미연동
            "is_active"     : is_active,
            "filed_at"      : reg_date or app_date,  # 등록일 우선, 없으면 출원일
        })

    print(f"  유효 특허(타겟 기업): {valid_count}건")
    print(f"  최근 5년 등록 특허:   {active_patents}건")
    print(f"  SK하이닉스 공동출원:  {joint_patent_count}건")
    print(f"  전체 IPC 코드 수:     {len(all_ipc_codes)}개")

    return {
        "active_patents"    : active_patents,
        "total_patents"     : valid_count,
        "joint_patent_count": joint_patent_count,
        "ipc_codes"         : all_ipc_codes,
        "inventor_count"    : 0,
        "patent_records"    : patent_records,
    }


# -------------------------------------------------------
# 4. DB 저장 (개별 특허 저장으로 변경)
# -------------------------------------------------------

def get_company_id(conn, normalized_name: str) -> int | None:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM companies WHERE corp_name = %s LIMIT 1",
            (normalized_name,)
        )
        row = cur.fetchone()
        return row[0] if row else None


def delete_existing_patents(conn, company_id: int):
    """
    기존 특허 데이터 삭제 후 재수집.
    (SUMMARY_ 요약본 포함 전부 삭제)
    """
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM patents WHERE company_id = %s",
            (company_id,)
        )
    print(f"  기존 특허 데이터 삭제 완료 (company_id={company_id})")


def insert_patents(conn, company_id: int, patent_records: list):
    """
    개별 특허를 patents 테이블에 저장.
    patent_no가 비어있는 경우 스킵.
    """
    sql = """
        INSERT INTO patents (
            company_id, patent_no, ipc_code,
            inventor_count, is_active, filed_at, created_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, NOW()
        )
        ON CONFLICT (patent_no) DO UPDATE SET
            ipc_code       = EXCLUDED.ipc_code,
            inventor_count = EXCLUDED.inventor_count,
            is_active      = EXCLUDED.is_active,
            filed_at       = EXCLUDED.filed_at
    """
    saved = 0
    with conn.cursor() as cur:
        for rec in patent_records:
            if not rec["patent_no"]:
                continue
            cur.execute(sql, (
                company_id,
                rec["patent_no"],
                rec["ipc_code"],
                rec["inventor_count"],
                rec["is_active"],
                rec["filed_at"],
            ))
            saved += 1

    conn.commit()
    print(f"  개별 특허 저장 완료: {saved}건")


def save_to_db(patent_summary: dict):
    try:
        conn = psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"  [오류] DB 연결 실패: {e}")
        return

    try:
        company_id = get_company_id(conn, patent_summary["normalized_name"])
        if company_id is None:
            print(f"  [경고] companies 테이블에 없는 기업: {patent_summary['normalized_name']}")
            return

        # 기존 데이터 삭제 후 재저장
        delete_existing_patents(conn, company_id)
        insert_patents(conn, company_id, patent_summary["patent_records"])

    finally:
        conn.close()


# -------------------------------------------------------
# 5. 전체 파이프라인 실행
# -------------------------------------------------------

def run_collection(target_companies: list):
    normalizer = CompanyNormalizer()
    results = {}

    for company in target_companies:
        normalized  = company["normalized_name"]
        kipris_name = company["kipris_search_name"]

        print(f"\n{'='*50}")
        print(f"기업: {normalized} (KIPRIS 검색어: {kipris_name})")
        print(f"{'='*50}")

        all_patents = fetch_all_patents(kipris_name)
        if not all_patents:
            print(f"  특허 없음, 건너뜀")
            continue

        analysis = analyze_patents(all_patents, normalized, normalizer)

        results[normalized] = {
            "normalized_name"   : normalized,
            "kipris_search_name": kipris_name,
            **analysis
        }

        save_to_db(results[normalized])
        time.sleep(1)

    return results


# -------------------------------------------------------
# 실행
# -------------------------------------------------------
if __name__ == "__main__":

    TARGET_COMPANIES = [
        {"normalized_name": "한미반도체",   "kipris_search_name": "한미반도체"},
        {"normalized_name": "원익QnC",     "kipris_search_name": "원익큐엔씨"},
        {"normalized_name": "솔브레인",    "kipris_search_name": "솔브레인"},
        {"normalized_name": "파크시스템스", "kipris_search_name": "파크시스템스"},
        {"normalized_name": "피에스케이",  "kipris_search_name": "피에스케이"},
    ]

    print("KIPRIS 특허 수집 시작 (v2 — 개별 특허 저장)")
    print(f"대상 기업: {len(TARGET_COMPANIES)}개사")
    print(f"active_patents 기준: 등록일 기준 최근 {ACTIVE_YEARS}년")

    results = run_collection(TARGET_COMPANIES)

    print(f"\n{'='*60}")
    print("수집 결과 요약")
    print(f"{'='*60}")
    print(f"{'기업':15} {'전체':>8} {'최근5년등록':>12} {'공동출원':>8} {'IPC수':>8}")
    print("-" * 60)
    for name, data in results.items():
        print(
            f"{name:15}"
            f"{data['total_patents']:>8}"
            f"{data['active_patents']:>12}"
            f"{data['joint_patent_count']:>8}"
            f"{len(data['ipc_codes']):>8}"
        )