import sys
sys.path.insert(0, '.')
from src.features.feature_calculator import get_inventor_yoy

# 파크시스템스(company_id=7)만 테스트 — 12건이라 가장 적음
result = get_inventor_yoy(7)
print(f"\n결과: inventor_count_yoy = {result}")
