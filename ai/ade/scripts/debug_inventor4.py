import os, requests
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
load_dotenv()

url = "http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch"
params = {
    "applicationNumber": "1020240115360",
    "ServiceKey": os.getenv("KIPRIS_API_KEY"),
}
resp = requests.get(url, params=params, timeout=15)

# 1. ET.fromstring으로 파싱
root = ET.fromstring(resp.text)

# 2. resultCode 확인
result_code = root.findtext(".//resultCode", "")
print(f"result_code = '{result_code}'")
print(f"result_code == '00' → {result_code == '00'}")

# 3. inventorInfo iter 확인
count = 0
for inv in root.iter("inventorInfo"):
    count += 1
    name = inv.findtext("name", "")
    print(f"  발명자 {count}: name='{name}'")

print(f"\n총 inventorInfo 개수: {count}")
