import sys, time
sys.path.insert(0, '.')
import os, requests
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
load_dotenv()

# 파크시스템스 12건 전부 순차 호출 — 매 건마다 raw 상태 확인
patent_nos = [
    "1020240115360", "1020210125985", "1020200189823", "1020200177071",
    "1020210125981", "1020200066191", "1020200160530", "1020200168485",
    "1020200065915", "1020220125103", "1020210102185", "1020200017159",
]

url = "http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch"

for i, no in enumerate(patent_nos):
    formatted = f"{no[0:2]}-{no[2:6]}-{no[6:13]}"
    params = {
        "applicationNumber": formatted,
        "ServiceKey": os.getenv("KIPRIS_API_KEY"),
    }
    resp = requests.get(url, params=params, timeout=15)

    try:
        root = ET.fromstring(resp.text)
        result_code = root.findtext(".//resultCode", "")
        names = [inv.findtext("name","") for inv in root.iter("inventorInfo")]
        print(f"{i+1}. {formatted}: resultCode={result_code}, 발명자={names}")
    except ET.ParseError as e:
        print(f"{i+1}. {formatted}: [XML 파싱 실패] {e}")
        print(f"   응답 앞부분: {resp.text[:200]}")

    time.sleep(0.3)
