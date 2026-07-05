import requests, os
from dotenv import load_dotenv
load_dotenv()

companies = {
    '원익QnC':      '00468374',
    '솔브레인':     '01489648',
    '파크시스템스': '00244747',
}

for name, code in companies.items():
    r = requests.get(
        'https://opendart.fss.or.kr/api/list.json',
        params={
            'crtfc_key': os.getenv('DART_API_KEY'),
            'corp_code': code,
            'bgn_de': '20260101',
            'end_de': '20261231',
            'pblntf_ty': 'A',
        }
    )
    items = r.json().get('list', [])
    print(f"=== {name} ===")
    for item in items[:3]:
        print(f"  {item.get('report_nm')} | rcept_no={item.get('rcept_no')} | {item.get('rcept_dt')}")
