import requests, os
from dotenv import load_dotenv
load_dotenv()

r = requests.get(
    'https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json',
    params={
        'crtfc_key': os.getenv('DART_API_KEY'),
        'corp_code': '00161383',
        'bsns_year': '2025',
        'reprt_code': '11011',
        'fs_div': 'CFS',
    }
)
data = r.json()
items = data.get('list', [])
print(f"2025년 전체 계정 수: {len(items)}개")

for item in items:
    if item.get('account_nm') in ['매출액', '연구개발비', '영업이익']:
        print(item.get('account_nm'), '|', item.get('thstrm_amount'))
