import requests, os, zipfile, io
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
    # 메인 문서로 보이는 파일 (보통 가장 큰 파일이 본문)
    sizes = [(name, z.getinfo(name).file_size) for name in z.namelist()]
    sizes.sort(key=lambda x: -x[1])
    print("파일 크기순:")
    for name, size in sizes:
        print(f"  {name}: {size:,} bytes")

    main_file = sizes[0][0]
    print(f"\n가장 큰 파일로 시도: {main_file}")

    with z.open(main_file) as f:
        raw = f.read()

    # 여러 인코딩 시도
    for enc in ['utf-8', 'euc-kr', 'cp949', 'utf-16']:
        try:
            content = raw.decode(enc)
            if '연구' in content or '개발' in content:
                print(f"\n[{enc} 성공] '연구개발' 텍스트 발견!")
                idx = content.find('연구개발')
                if idx == -1:
                    idx = content.find('연구')
                print(content[max(0,idx-100):idx+500])
                break
            else:
                print(f"[{enc}] 디코딩은 됐지만 '연구' 텍스트 없음. 샘플: {content[200:300]}")
        except Exception as e:
            print(f"[{enc}] 실패: {e}")