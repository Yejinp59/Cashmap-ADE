import sys
sys.path.insert(0, '.')
import time
from collections import defaultdict
from src.features.feature_calculator import _get_active_patent_numbers, _fetch_inventors

patents = _get_active_patent_numbers(7)  # 파크시스템스

year_inventors = defaultdict(set)
for p in patents:
    if not p["filed_at"]:
        continue
    year = p["filed_at"].year
    inventors = _fetch_inventors(p["patent_no"])
    year_inventors[year].update(inventors)
    time.sleep(0.3)

print("=== 연도별 발명자 상세 ===")
for year in sorted(year_inventors.keys()):
    print(f"\n{year}년 ({len(year_inventors[year])}명):")
    for name in sorted(year_inventors[year]):
        print(f"  - {name}")

# 2024 vs 2025 겹치는 사람 / 다른 사람 비교
if 2024 in year_inventors and 2025 in year_inventors:
    set_2024 = year_inventors[2024]
    set_2025 = year_inventors[2025]
    print(f"\n2024년에만 있는 사람: {set_2024 - set_2025}")
    print(f"2025년에만 있는 사람: {set_2025 - set_2024}")
    print(f"둘 다 있는 사람: {set_2024 & set_2025}")
