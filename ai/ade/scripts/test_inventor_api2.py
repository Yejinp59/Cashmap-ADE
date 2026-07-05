import requests, os
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
load_dotenv()

KIPRIS_API_KEY = os.getenv("KIPRIS_API_KEY")

url = "http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch"
params = {
    "applicationNumber": "1020230106994",
    "ServiceKey": KIPRIS_API_KEY,
}

r = requests.get(url, params=params, timeout=15)
root = ET.fromstring(r.text)

# 발명자 정보 찾기
print("=== 전체 태그 목록 (발명자 관련) ===")
for elem in root.iter():
    if 'inventor' in elem.tag.lower() or 'Inventor' in elem.tag:
        print(f"{elem.tag}: {elem.text}")

print("\n=== applicantInfo / inventorInfo 배열 확인 ===")
for elem in root.iter():
    if 'Array' in elem.tag and ('applicant' in elem.tag.lower() or 'inventor' in elem.tag.lower()):
        print(f"\n[{elem.tag}]")
        for child in elem.iter():
            if child.text and child.text.strip():
                print(f"  {child.tag}: {child.text}")
