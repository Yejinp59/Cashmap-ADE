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

# 매출/연구개발/영업이익 관련 키워드 포함된 계정 전부 출력
keywords = ['매출', '연구', '개발', '영업이익', '수익']
for item in items:
    nm = item.get('account_nm', '')
    if any(k in nm for k in keywords):
        print(nm, '|', item.get('thstrm_amount'), '|', item.get('sj_nm'))
