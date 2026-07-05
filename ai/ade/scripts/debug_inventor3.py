import os, requests
from dotenv import load_dotenv
load_dotenv()

url = "http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch"
params = {
    "applicationNumber": "1020240115360",
    "ServiceKey": os.getenv("KIPRIS_API_KEY"),
}
resp = requests.get(url, params=params, timeout=15)

# inventorInfo 부분만 찾아서 출력
text = resp.text
idx = text.find("inventorInfo")
if idx == -1:
    print("'inventorInfo' 텍스트가 응답에 아예 없음")
    print(f"\n전체 응답 길이: {len(text)}")
    print(f"\n전체 응답:\n{text}")
else:
    print(f"'inventorInfo' 위치: {idx}")
    print(text[idx-50:idx+800])
