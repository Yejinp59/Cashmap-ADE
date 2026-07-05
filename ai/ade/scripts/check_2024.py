import requests, os
from dotenv import load_dotenv
load_dotenv()

for year in ["2024", "2025"]:
    r = requests.get(
        'https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json',
        params={
            'crtfc_key': os.getenv('DART_API_KEY'),
            'corp_code': '00161383',
            'bsns_year': year,
            'reprt_code': '11011',
            'fs_div': 'CFS',
        }
    )
    data = r.json()
    print(f"{year}년: status={data.get('status')}, message={data.get('message','')}")
