import os, time, requests
import xml.etree.ElementTree as ET
from dotenv import load_dotenv
load_dotenv()

url = "http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch"

# 1번만 단독으로 2초 간격 두고 3번 재시도
formatted = "10-2024-0115360"
for attempt in range(3):
    params = {
        "applicationNumber": formatted,
        "ServiceKey": os.getenv("KIPRIS_API_KEY"),
    }
    resp = requests.get(url, params=params, timeout=15)
    root = ET.fromstring(resp.text)
    result_code = root.findtext(".//resultCode", "")
    names = [inv.findtext("name","") for inv in root.iter("inventorInfo")]
    print(f"시도 {attempt+1}: resultCode={result_code}, 발명자={names}")
    time.sleep(2)
