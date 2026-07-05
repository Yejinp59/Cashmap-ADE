import requests, os, zipfile, io, re
from dotenv import load_dotenv
load_dotenv()

def fetch_document_xml(rcp_no: str) -> str:
    r = requests.get(
        'https://opendart.fss.or.kr/api/document.xml',
        params={
            'crtfc_key': os.getenv('DART_API_KEY'),
            'rcept_no': rcp_no,
        }
    )
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        sizes = [(name, z.getinfo(name).file_size) for name in z.namelist()]
        sizes.sort(key=lambda x: -x[1])
        main_file = sizes[0][0]
        with z.open(main_file) as f:
            return f.read().decode('utf-8')

content = fetch_document_xml("20260319000022")  # 파크시스템스

# '연구개발' 주변 텍스트 전부 찾기
indices = [m.start() for m in re.finditer('연구개발', content)]
print(f"'연구개발' 발견 횟수: {len(indices)}\n")

for i, idx in enumerate(indices):
    snippet = content[idx:idx+60].replace('\n', ' ')
    print(f"{i+1}. 위치 {idx}: {snippet}")
