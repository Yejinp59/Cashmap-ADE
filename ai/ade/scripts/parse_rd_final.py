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


# 회사마다 다른 비율 키워드들 (전부 시도)
RATIO_KEYWORDS = [
    '연구개발비 / 매출액 비율',
    '연구개발비/매출액 비율',
    '매출액 대비 비율',
    '연구개발비용 / 매출액 비율',
]


def parse_rd_ratio_pct(content: str) -> list[float]:
    """
    R&D 비율(%) 텍스트를 찾아서 [당기, 전기, 전전기] 순으로 반환.
    여러 키워드 후보를 순서대로 시도.
    """
    for keyword in RATIO_KEYWORDS:
        idx = content.find(keyword)
        if idx != -1:
            window = content[idx:idx+1200]  # 표가 길 수 있어 넉넉하게
            matches = re.findall(r'<TD[^>]*>([\d.]+)%</TD>', window)
            if not matches:
                # TH 태그인 경우도 대응
                matches = re.findall(r'<TH[^>]*>([\d.]+)%</TH>', window)
            if matches:
                return [float(m) for m in matches[:3]]
    return []


def parse_unit(content: str, near_idx: int) -> str:
    """근처 '(단위 : OOO)' 텍스트로 단위 파악 (참고용, rd_ratio엔 영향 없음)"""
    window = content[max(0, near_idx-300):near_idx]
    m = re.search(r'\(단위\s*[:：]\s*([^)]+)\)', window)
    return m.group(1) if m else "확인불가"


# ── 4개사 일괄 테스트 ──
companies = {
    '피에스케이':   '20260323000017',
    '원익QnC':      '20260323001246',
    '솔브레인':     '20260316001567',
    '파크시스템스': '20260319000022',
}

results = {}
for name, rcp in companies.items():
    print(f"\n{'='*40}")
    print(f"  {name}")
    print(f"{'='*40}")
    content = fetch_document_xml(rcp)
    ratios = parse_rd_ratio_pct(content)

    for keyword in RATIO_KEYWORDS:
        idx = content.find(keyword)
        if idx != -1:
            unit = parse_unit(content, idx)
            print(f"  매칭 키워드: '{keyword}'")
            print(f"  단위: {unit}")
            break

    print(f"  R&D 비율(%): {ratios}")
    results[name] = ratios

print(f"\n{'='*40}")
print("최종 요약 (당기 기준 rd_ratio)")
print(f"{'='*40}")
for name, ratios in results.items():
    if ratios:
        print(f"  {name}: {ratios[0]}% (rd_ratio={ratios[0]/100:.4f})")
    else:
        print(f"  {name}: 파싱 실패")
