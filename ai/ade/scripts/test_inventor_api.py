import requests, os
from dotenv import load_dotenv
load_dotenv()

# 한미반도체 특허 중 하나로 테스트 (DB에서 확인된 출원/등록번호 샘플)
# getBibliographyInfo 또는 getAdvancedSearchDetail 등 후보 엔드포인트 시도

KIPRIS_API_KEY = os.getenv("KIPRIS_API_KEY")

# 후보 1: 서지정보 상세 조회 API
url1 = "http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch"
params1 = {
    "applicationNumber": "1020230106994",  # 아까 한미반도체 DB에서 본 출원번호
    "ServiceKey": KIPRIS_API_KEY,
}

r1 = requests.get(url1, params=params1, timeout=15)
print("=== 후보1: getBibliographyDetailInfoSearch ===")
print("status:", r1.status_code)
print(r1.text[:1500])
