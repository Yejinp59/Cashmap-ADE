"""
법인명 정규화 모듈
- DART 기업명과 KIPRIS 기업명을 하나의 공통 키로 통일
- 사용법: normalizer = CompanyNormalizer(); normalizer.normalize("한미반도체 주식회사")
"""

import csv
import re
import os


class CompanyNormalizer:
    def __init__(self, csv_path: str = None):
        """
        csv_path: company_names.csv 경로
        지정하지 않으면 이 파일 기준으로 자동 탐색
        """
        if csv_path is None:
            # 이 파일(normalizer.py)이 있는 폴더 기준으로 CSV 찾기
            current_dir = os.path.dirname(os.path.abspath(__file__))
            csv_path = os.path.join(current_dir, "company_names.csv")

        self.csv_path = csv_path
        self.mapping = {}       # raw_name -> normalized_name
        self.kipris_map = {}    # normalized_name -> kipris_search_name
        self.corp_code_map = {} # normalized_name -> corp_code

        self._load_csv()

    def _load_csv(self):
        """CSV 파일을 읽어서 매핑 딕셔너리 구성"""
        if not os.path.exists(self.csv_path):
            print(f"[경고] CSV 파일을 찾을 수 없습니다: {self.csv_path}")
            return

        with open(self.csv_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                raw = row["raw_name"].strip()
                normalized = row["normalized_name"].strip()
                corp_code = row["corp_code"].strip()
                kipris = row["kipris_search_name"].strip()

                # raw_name → normalized_name 매핑
                self.mapping[raw] = normalized

                # normalized_name → kipris_search_name, corp_code 매핑
                # (같은 normalized_name이 여러 번 나올 수 있지만 덮어써도 동일한 값)
                self.kipris_map[normalized] = kipris
                self.corp_code_map[normalized] = corp_code

        print(f"[완료] 법인명 매핑 {len(self.mapping)}건 로드")

    def _clean_by_rule(self, name: str) -> str:
        """
        규칙 기반 자동 정규화
        CSV에 없는 이름도 처리할 수 있도록 접두/접미어 제거
        예: "주식회사 XXX" → "XXX", "(주)XXX" → "XXX"
        """
        # 앞뒤 공백 제거
        name = name.strip()

        # 접두어 제거: "주식회사 ", "㈜", "(주)"
        name = re.sub(r"^주식회사\s*", "", name)
        name = re.sub(r"^㈜\s*", "", name)
        name = re.sub(r"^\(주\)\s*", "", name)

        # 접미어 제거: " 주식회사", "(주)", "㈜"
        name = re.sub(r"\s*주식회사$", "", name)
        name = re.sub(r"\s*\(주\)$", "", name)
        name = re.sub(r"\s*㈜$", "", name)

        return name.strip()

    def normalize(self, raw_name: str) -> str:
        """
        기업명을 정규화된 이름으로 변환
        
        1단계: CSV 매핑 테이블에서 직접 찾기
        2단계: 없으면 규칙 기반으로 자동 처리
        3단계: 그래도 모르면 원본 그대로 반환
        
        예시:
            normalize("한미반도체 주식회사") → "한미반도체"
            normalize("(주)원익QnC")        → "원익QnC"
        """
        if not raw_name:
            return raw_name

        # 1단계: CSV에서 직접 찾기
        if raw_name in self.mapping:
            return self.mapping[raw_name]

        # 2단계: 규칙 기반 자동 처리 후 다시 CSV에서 찾기
        cleaned = self._clean_by_rule(raw_name)
        if cleaned in self.mapping:
            return self.mapping[cleaned]

        # 3단계: 규칙 처리 결과 그대로 반환 (CSV에 없는 새 회사)
        return cleaned

    def get_kipris_name(self, normalized_name: str) -> str:
        """
        정규화된 이름 → KIPRIS 검색용 이름 반환
        예: get_kipris_name("원익QnC") → "원익큐엔씨"
        """
        return self.kipris_map.get(normalized_name, normalized_name)

    def get_corp_code(self, normalized_name: str) -> str:
        """
        정규화된 이름 → DART corp_code 반환
        예: get_corp_code("한미반도체") → "00215939"
        """
        return self.corp_code_map.get(normalized_name, None)

    def normalize_and_get_kipris(self, raw_name: str) -> tuple:
        """
        한 번에 정규화 + KIPRIS 검색어 반환
        반환값: (normalized_name, kipris_search_name)
        
        예시:
            normalize_and_get_kipris("원익QnC 주식회사")
            → ("원익QnC", "원익큐엔씨")
        """
        normalized = self.normalize(raw_name)
        kipris = self.get_kipris_name(normalized)
        return normalized, kipris


# -------------------------------------------------------
# 테스트 (이 파일을 직접 실행할 때만 동작)
# -------------------------------------------------------
if __name__ == "__main__":
    normalizer = CompanyNormalizer()

    # 테스트 케이스
    test_cases = [
        "한미반도체 주식회사",
        "(주)한미반도체",
        "한미반도체(주)",
        "원익QnC 주식회사",
        "주식회사 원익QnC",
        "주식회사 원익큐엔씨",
        "솔브레인 주식회사",
        "솔브레인홀딩스 주식회사",
        "피에스케이홀딩스 (주)",
        "SK하이닉스 주식회사",
        "에스케이하이닉스 주식회사",
        "삼성전자 주식회사",
        "주식회사 모르는회사",   # CSV에 없는 케이스
    ]

    print("\n=== 법인명 정규화 테스트 ===")
    print(f"{'입력':30} {'정규화':15} {'KIPRIS검색어':15} {'corp_code'}")
    print("-" * 80)

    for name in test_cases:
        normalized, kipris = normalizer.normalize_and_get_kipris(name)
        corp_code = normalizer.get_corp_code(normalized) or "없음"
        print(f"{name:30} {normalized:15} {kipris:15} {corp_code}")
