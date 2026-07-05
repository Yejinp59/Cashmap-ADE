import requests, os
from dotenv import load_dotenv
load_dotenv()

companies = {
    '피에스케이':   '01365825',
    '원익QnC':      '00468374',
    '솔브레인':     '01489648',
    '파크시스템스': '00244747',
}

for name, code in companies.items():
    print(f"\n{'='*50}")
    print(f"  {name}")
    print(f"{'='*50}")
    r = requests.get(
        'https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json',
        params={
            'crtfc_key': os.getenv('DART_API_KEY'),
            'corp_code': code,
            'bsns_year': '2025',
            'reprt_code': '11011',
            'fs_div': 'CFS',
        }
    )
    data = r.json()
    items = data.get('list', [])
    keywords = ['연구', '개발', 'R&D']
    found = False
    for item in items:
        nm = item.get('account_nm', '')
        if any(k in nm for k in keywords):
            print(f"  {nm} | {item.get('thstrm_amount')}")
            found = True
    if not found:
        print("  R&D 관련 항목 없음 (판관비 등에 통합 추정)")
