import requests, os
from dotenv import load_dotenv
load_dotenv()

r = requests.get(
    'https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json',
    params={
        'crtfc_key': os.getenv('DART_API_KEY'),
        'corp_code': '00161383',
        'bsns_year': '2026',
        'reprt_code': '11011',
        'fs_div': 'CFS',
    }
)
data = r.json()
print(f"status: {data.get('status')}")
print(f"message: {data.get('message')}")
