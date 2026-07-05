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


def parse_rd_ratio_pct(content: str) -> list[float]:
    idx = content.find('연구개발비 / 매출액 비율')
    if idx == -1:
        idx = content.find('연구개발비/매출액 비율')
    if idx == -1:
        idx = content.find('매출액 대비 연구개발비')  # 다른 표현 가능성
    if idx == -1:
        return []
    window = content[idx:idx+1000]
    matches = re.findall(r'<TD[^>]*>([\d.]+)%</TD>', window)
    return [float(m) for m in matches]


def parse_rd_amount_million(content: str) -> list[float]:
    idx = content.find('연구개발비용 계')
    if idx == -1:
        idx = content.find('연구개발비 계')
    if idx == -1:
        return []
    window = content[idx:idx+400]  # 정부보조금 행 전에서 끊기
    matches = re.findall(r'<TD[^>]*>([\d,]+)</TD>', window)
    return [float(m.replace(',', '')) for m in matches[:3]]


companies = {
    '원익QnC':      '20260323001246',
    '솔브레인':     '20260316001567',
    '파크시스템스': '20260319000022',
}

for name, rcp in companies.items():
    print(f"\n{'='*40}")
    print(f"  {name}")
    print(f"{'='*40}")
    try:
        content = fetch_document_xml(rcp)
        ratios = parse_rd_ratio_pct(content)
        amounts = parse_rd_amount_million(content)
        print("R&D 비율(%):", ratios)
        print("R&D 금액(백만원):", amounts)

        if not ratios and not amounts:
            # 키워드 자체가 있는지 확인
            has_keyword = '연구개발' in content
            print(f"'연구개발' 텍스트 존재 여부: {has_keyword}")
    except Exception as e:
        print(f"오류: {e}")
