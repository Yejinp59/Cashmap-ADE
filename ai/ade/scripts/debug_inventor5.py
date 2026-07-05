import re

def _format_application_number(raw_no: str) -> str:
    if "-" in raw_no:
        return raw_no
    digits = re.sub(r"\D", "", raw_no)
    if len(digits) == 13:
        return f"{digits[0:2]}-{digits[2:6]}-{digits[6:13]}"
    return raw_no

# 파크시스템스 실제 patent_no 샘플로 테스트
test_numbers = [
    "1020240115360",
    "1020210125985",
    "1020200189823",
]

for raw in test_numbers:
    formatted = _format_application_number(raw)
    print(f"원본: {raw} → 변환: {formatted}")
