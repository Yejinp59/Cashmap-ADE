import sys
sys.path.insert(0, '.')
from src.features.feature_calculator import get_inventor_yoy

result = get_inventor_yoy(4)  # 원익QnC
print(f"\n결과: inventor_count_yoy = {result}")
