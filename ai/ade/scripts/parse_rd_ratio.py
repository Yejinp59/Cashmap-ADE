import requests, os, zipfile, io, re
from dotenv import load_dotenv
load_dotenv()


def fetch_document_xml(rcp_no: str) -> str:
    """DART 사업보고서 원문(zip) → 가장 큰 xml 파일 텍스트 반환"""
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
    """
    '연구개발비 / 매출액 비율' 텍스트 다음에 나오는 <TD> 안의 퍼센트 값들 추출.
    반환: [당기%, 전기%, 전전기%] (있는 만큼)
    """
    idx = content.find('연구개발비 / 매출액 비율')
    if idx == -1:
        idx = content.find('연구개발비/매출액 비율')
    if idx == -1:
        return []

    # 이후 800자 내에서 <TD ...>숫자%</TD> 패턴 찾기
    window = content[idx:idx+1000]
    matches = re.findall(r'<TD[^>]*>([\d.]+)%</TD>', window)
    return [float(m) for m in matches]


def parse_rd_amount_million(content: str) -> list[float]:
    """
    '연구개발비용 계' 텍스트 다음에 나오는 <TD> 안의 금액(백만원) 추출.
    반환: [당기, 전기, 전전기] (백만원 단위, 있는 만큼)
    """
    idx = content.find('연구개발비용 계')
    if idx == -1:
        return []

    window = content[idx:idx+800]
    # <TD ...>35,728</TD> 형태 (쉼표 포함 숫자, %나 -는 제외)
    matches = re.findall(r'<TD[^>]*>([\d,]+)</TD>', window)
    return [float(m.replace(',', '')) for m in matches]


# ── 테스트: 피에스케이 ──
rcp_no = "20260323000017"
content = fetch_document_xml(rcp_no)

ratios = parse_rd_ratio_pct(content)
amounts = parse_rd_amount_million(content)

print("R&D 비율(%):", ratios)
print("R&D 금액(백만원):", amounts)
