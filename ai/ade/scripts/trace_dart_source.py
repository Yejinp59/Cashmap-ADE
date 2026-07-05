"""
한미반도체 rd_ratio가 DART의 어떤 항목에서 왔는지 직접 추적
"""
import requests, os, json
from dotenv import load_dotenv
load_dotenv()

CORP_CODE = "00161383"  # 한미반도체
YEARS = ["2021", "2022", "2023"]

ACCOUNT_MAP = {
    "revenue":    ["매출액", "수익(매출액)"],
    "rd_expense": ["연구개발비", "경상연구개발비", "연구비", "연구개발비용"],
    "op_income":  ["영업이익", "영업이익(손실)"],
}

for year in YEARS:
    print(f"\n{'='*70}")
    print(f"  {year}년 — corp_code={CORP_CODE} (한미반도체)")
    print(f"{'='*70}")

    r = requests.get(
        'https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json',
        params={
            'crtfc_key': os.getenv('DART_API_KEY'),
            'corp_code': CORP_CODE,
            'bsns_year': year,
            'reprt_code': '11011',
            'fs_div': 'CFS',
        }
    )
    data = r.json()

    if data.get('status') != '000':
        print(f"  [오류] status={data.get('status')}, message={data.get('message')}")
        continue

    items = data.get('list', [])
    print(f"  전체 계정 수: {len(items)}개\n")

    for category, candidates in ACCOUNT_MAP.items():
        found = False
        for item in items:
            account_nm = item.get('account_nm', '')
            if account_nm in candidates:
                amount = item.get('thstrm_amount', '')
                sj_nm = item.get('sj_nm', '')        # 재무제표명 (재무상태표/손익계산서 등)
                fs_div = item.get('fs_div', '')      # 개별/연결
                fs_nm = item.get('fs_nm', '')
                print(f"  [{category}] 매칭됨")
                print(f"    account_nm : {account_nm}")
                print(f"    thstrm_amount : {amount}")
                print(f"    sj_nm (재무제표 구분) : {sj_nm}")
                print(f"    fs_div : {fs_div} / fs_nm : {fs_nm}")
                print()
                found = True
                break
        if not found:
            print(f"  [{category}] 매칭 안 됨 — 후보: {candidates}")
            print()
