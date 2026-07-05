import os, re, requests
from dotenv import load_dotenv
import psycopg2, psycopg2.extras
load_dotenv()

def get_conn():
    return psycopg2.connect(os.getenv("DATABASE_URL"))

with get_conn() as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT patent_no, filed_at
            FROM patents
            WHERE company_id = 5 AND is_active = TRUE
            LIMIT 5
        """)
        rows = cur.fetchall()

print("=== DB에 저장된 patent_no 샘플 (한미반도체) ===")
for r in rows:
    print(f"patent_no={r['patent_no']}, filed_at={r['filed_at']}")

def _format_application_number(raw_no: str) -> str:
    if "-" in raw_no:
        return raw_no
    digits = re.sub(r"\D", "", raw_no)
    if len(digits) == 13:
        return f"{digits[0:2]}-{digits[2:6]}-{digits[6:13]}"
    return raw_no

print("\n=== 변환된 출원번호 + 실제 API 응답 ===")
for r in rows:
    app_no = _format_application_number(r['patent_no'])
    print(f"\n원본: {r['patent_no']} → 변환: {app_no}")

    url = "http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch"
    params = {
        "applicationNumber": app_no,
        "ServiceKey": os.getenv("KIPRIS_API_KEY"),
    }
    resp = requests.get(url, params=params, timeout=15)

    import xml.etree.ElementTree as ET
    root = ET.fromstring(resp.text)
    result_code = root.findtext(".//resultCode", "")
    result_msg = root.findtext(".//resultMsg", "")
    print(f"  resultCode={result_code}, resultMsg={result_msg}")

    names = [inv.findtext("name","") for inv in root.iter("inventorInfo")]
    print(f"  발명자: {names}")
