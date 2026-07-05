import os, requests
from dotenv import load_dotenv
import psycopg2, psycopg2.extras
load_dotenv()

def get_conn():
    return psycopg2.connect(os.getenv("DATABASE_URL"))

# 파크시스템스 active patent의 patent_no 직접 확인
with get_conn() as conn:
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT patent_no, filed_at
            FROM patents
            WHERE company_id = 7 AND is_active = TRUE
        """)
        rows = cur.fetchall()

print("=== 파크시스템스 active patent 전체 ===")
for r in rows:
    print(f"patent_no={r['patent_no']}, filed_at={r['filed_at']}")

# 첫 번째 건으로 직접 API 호출 (raw 응답 전체 출력)
first = rows[0]['patent_no']
print(f"\n=== '{first}' 로 직접 조회 (raw 응답) ===")

url = "http://plus.kipris.or.kr/kipo-api/kipi/patUtiModInfoSearchSevice/getBibliographyDetailInfoSearch"
params = {
    "applicationNumber": first,
    "ServiceKey": os.getenv("KIPRIS_API_KEY"),
}
resp = requests.get(url, params=params, timeout=15)
print("status:", resp.status_code)
print(resp.text[:2000])
