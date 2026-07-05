import requests, os
from dotenv import load_dotenv
load_dotenv()

# 피에스케이 사업보고서 rcpNo (캡처 화면에서 확인됨)
rcp_no = "20260323000017"

r = requests.get(
    'https://opendart.fss.or.kr/api/document.xml',
    params={
        'crtfc_key': os.getenv('DART_API_KEY'),
        'rcept_no': rcp_no,
    }
)

print("status code:", r.status_code)
print("content-type:", r.headers.get('content-type'))
print("길이:", len(r.content))
print("처음 500자:")
print(r.text[:500] if 'xml' in r.headers.get('content-type','') or 'text' in r.headers.get('content-type','') else "바이너리 데이터(zip 등)")
