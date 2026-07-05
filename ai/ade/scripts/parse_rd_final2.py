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


RATIO_KEYWORDS = [
    '연구개발비 / 매출액 비율',
    '연구개발비/매출액 비율',
    '매출액 대비 비율',
    '연구개발비용 / 매출액 비율',
]


def parse_rd_ratio_pct(content: str) -> list[float]:
    for keyword in RATIO_KEYWORDS:
        idx = content.find(keyword)
        if idx == -1:
            continue

        # 키워드가 들어있는 <TD>...</TD> 또는 <TH>...</TH> 자체를 찾고,
        # 그 다음에 바로 이어지는 TD/TH 셀들에서 숫자(% 있어도 없어도 OK) 추출
        window = content[idx:idx+1500]

        # 키워드가 포함된 셀이 끝나는 지점(첫 </TD> 또는 </TH>) 이후부터 탐색
        cell_end = re.search(r'</T[DH]>', window)
        start = cell_end.end() if cell_end else 0
        search_zone = window[start:start+800]

        # 숫자(소수점 포함) + 선택적 % 기호, TD/TH 안에 있는 것
        matches = re.findall(r'<T[DH][^>]*>\s*([\d]+\.?[\d]*)\s*%?\s*</T[DH]>', search_zone)

        # 빈 문자열/단순 '-' 등 제외, 숫자만 필터링
        clean = [float(m) for m in matches if m and re.match(r'^[\d.]+$', m)]

        if clean:
            return clean[:3]

    return []


companies = {
    '피에스케이':   '20260323000017',
    '원익QnC':      '20260323001246',
    '솔브레인':     '20260316001567',
    '파크시스템스': '20260319000022',
}

print(f"{'='*40}")
print("최종 결과")
print(f"{'='*40}")
for name, rcp in companies.items():
    content = fetch_document_xml(rcp)
    ratios = parse_rd_ratio_pct(content)
    print(f"  {name}: {ratios}")
