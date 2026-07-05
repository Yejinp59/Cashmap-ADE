import requests, os
from dotenv import load_dotenv
load_dotenv()

for reprt_code, name in [('11013', '1분기'), ('11012', '반기'), ('11014', '3분기')]:
    r = requests.get('https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json', params={
        'crtfc_key': os.getenv('DART_API_KEY'),
        'corp_code': '01365825',
        'bsns_year': '2023',
        'reprt_code': reprt_code,
        'fs_div': 'CFS',
    })
    items = r.json().get('list', [])
    print(f'=== {name} ({reprt_code}) ===')
    found = False
    for item in items:
        nm = item.get('account_nm', '')
        if any(k in nm for k in ['연구', '개발', 'R&D']):
            print(f'  {nm} | {item.get("thstrm_amount")}')
            found = True
    if not found:
        print('  R&D 관련 항목 없음')