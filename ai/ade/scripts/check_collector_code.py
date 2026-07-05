# kipris_collector.py의 analyze_patents 함수에서
# patent_records 만드는 부분 재확인용 — 실제로 register_no를 쓰는지 application_no를 쓰는지 확인

# 한미반도체 응답에서 직접 등록번호 vs 출원번호 비교
import os, requests
from dotenv import load_dotenv
load_dotenv()

url = "http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getAdvancedSearch"
params = {
    "applicant": "한미반도체",
    "ServiceKey": os.getenv("KIPRIS_API_KEY"),
    "numOfRows": 5,
    "pageNo": 1,
}
resp = requests.get(url, params=params, timeout=15)

import xml.etree.ElementTree as ET
root = ET.fromstring(resp.text)

for item in root.findall(".//item")[:5]:
    app_no = item.findtext("applicationNumber", "")
    reg_no = item.findtext("registerNumber", "")
    print(f"출원번호: {app_no} | 등록번호: {reg_no}")
