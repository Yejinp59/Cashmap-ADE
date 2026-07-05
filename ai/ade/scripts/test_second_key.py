"""
새 KIPRIS 키가 제대로 작동하는지 빠르게 확인하는 스크립트.
.env에 KIPRIS_API_KEY_2 추가한 뒤 실행.
"""
import os, requests
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
load_dotenv()

key2 = os.getenv("KIPRIS_API_KEY_2")
if not key2:
    print("[오류] .env에 KIPRIS_API_KEY_2가 없어요. 추가하고 다시 실행해주세요.")
else:
    url = "http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch"
    params = {
        "applicationNumber": "1020240115360",  # 아까 발명자 4명 나왔던 검증된 특허
        "ServiceKey": key2,
    }
    resp = requests.get(url, params=params, timeout=15)
    root = ET.fromstring(resp.text)
    result_code = root.findtext(".//resultCode", "")
    names = [inv.findtext("name","") for inv in root.iter("inventorInfo")]
    print(f"resultCode={result_code}")
    print(f"발명자={names}")
    if names:
        print("\n✅ 새 키 정상 작동! 사용 가능합니다.")
    else:
        print("\n⚠️ 발명자가 비어있어요. 키 승인이 아직 안 됐거나 다른 문제가 있을 수 있어요.")
