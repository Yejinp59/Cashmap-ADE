import requests, os, zipfile, io, re
from dotenv import load_dotenv
load_dotenv()

rcp_no = "20260323000017"  # 피에스케이

r = requests.get(
    'https://opendart.fss.or.kr/api/document.xml',
    params={
        'crtfc_key': os.getenv('DART_API_KEY'),
        'rcept_no': rcp_no,
    }
)

with zipfile.ZipFile(io.BytesIO(r.content)) as z:
    with z.open('20260323000017.xml') as f:
        content = f.read().decode('utf-8')

# "연구개발비용 계" 텍스트가 나오는 모든 위치 찾기
indices = [m.start() for m in re.finditer('연구개발비용', content)]
print(f"'연구개발비용' 텍스트 발견 횟수: {len(indices)}\n")

for i, idx in enumerate(indices):
    print(f"=== 발견 {i+1} (위치 {idx}) ===")
    print(content[idx-50:idx+800])
    print()
