"""
Phase 4 — D-Score 산출기
파일 위치: src/scoring/d_scorer.py

룰베이스 가중합 방식.
결과는 d_scores 테이블에 저장.
"""

import os
import logging
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Phase 3 피처 계산기 임포트
# (같은 프로젝트 내에서 실행 시: from src.features.feature_calculator import ...)
from src.features.feature_calculator import compute_all_features #, compute_features

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# 가중치 설정 (기획보고서 기준)
# ──────────────────────────────────────────────

WEIGHTS = {
    "active_patents":     0.25,   # 높음: 최근 3년 등록 특허 수
    "ipc_entropy":        0.15,   # 중간: 기술 다각화 지수
    "inventor_count_yoy": 0.10,   # 중간: 발명자 수 증감률
    "rd_ratio":           0.20,   # 높음: R&D/매출 비중
    "rd_growth":          0.20,   # 높음: R&D 투자 YoY 성장률
    "op_margin_slope":    0.10,   # 중간: 영업이익률 추이 기울기
}
assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9, "가중치 합이 1.0이 아닙니다"

# 등급 구간
GRADE_THRESHOLDS = [
    (0.50, "POSITIVE"),   # D-Score 높음 → 숨은 진주 후보
    (0.25, "MONITOR"),    # D-Score 중간 → 모니터링
]


# ──────────────────────────────────────────────
# 정규화 파라미터 (도메인 지식 기반)
# ──────────────────────────────────────────────
# 각 피처를 [0, 1]로 Min-Max 정규화.
# 실운용 시 전체 샘플 통계로 교체 권장.

NORM_PARAMS: dict[str, dict] = {
    "active_patents":     {"min": 0,     "max": 150},    # 0~150건
    "ipc_entropy":        {"min": 0.0,   "max": 4.0},    # 0~4 bit
    "inventor_count_yoy": {"min": -0.5,  "max": 0.5},    # -50%~+50%
    "rd_ratio":           {"min": 0.0,   "max": 0.15},   # 0~15%
    "rd_growth":          {"min": -0.3,  "max": 0.5},    # -30%~+50%
    "op_margin_slope":    {"min": -0.05, "max": 0.05},   # 기울기
}


def _normalize(value: float, feature: str) -> float:
    """Min-Max 정규화 → [0, 1] 클리핑."""
    p = NORM_PARAMS[feature]
    rng = p["max"] - p["min"]
    if rng == 0:
        return 0.0
    normalized = (value - p["min"]) / rng
    return max(0.0, min(1.0, normalized))


# ──────────────────────────────────────────────
# D-Score 계산
# ──────────────────────────────────────────────

def calc_d_score(features: dict) -> dict:
    """
    피처 dict → D-Score (0.0 ~ 1.0) + 등급 계산.

    is_partial=True: DART 재무 미수집으로 일부 피처가 0인 경우.
    """
    feature_keys = list(WEIGHTS.keys())

    # 재무피처가 모두 0이면 부분점수로 표시
    dart_keys = ["rd_ratio", "rd_growth", "op_margin_slope"]
    is_partial = all(features.get(k, 0.0) == 0.0 for k in dart_keys)

    normalized: dict[str, float] = {}
    for key in feature_keys:
        raw = features.get(key, 0.0)
        normalized[key] = _normalize(raw, key)

    score = sum(normalized[k] * WEIGHTS[k] for k in feature_keys)
    grade = _grade(score)

    logger.info(
        f"[company_id={features.get('company_id')}] "
        f"D-Score={score:.4f} ({grade}), partial={is_partial}"
    )
    return {
        "company_id":         features["company_id"],
        "score":              round(score, 6),
        "grade":              grade,
        "is_partial":         is_partial,
        "patent_count":       features.get("active_patents", 0),
        "ipc_entropy":        features.get("ipc_entropy", 0.0),
        "inventor_growth":    features.get("inventor_count_yoy", 0.0),
        "rd_ratio":           features.get("rd_ratio", 0.0),
        "rd_growth":          features.get("rd_growth", 0.0),
        "op_margin_slope":    features.get("op_margin_slope", 0.0),
        "signal_score":       None,       # CashMap S-Score 연결 후 채움
        "calculated_at":      datetime.now(timezone.utc),
        "_normalized":        normalized,  # 디버그용 (DB 저장 제외)
    }


def _grade(score: float) -> str:
    if score >= 0.50:
        return "POSITIVE"
    elif score >= 0.25:
        return "MONITOR"
    else:
        return "NEGATIVE"


# ──────────────────────────────────────────────
# DB 저장
# ──────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def upsert_d_score(result: dict) -> None:
    """
    d_scores 테이블에 UPSERT.
    company_id 기준으로 기존 레코드가 있으면 UPDATE, 없으면 INSERT.
    (테이블에 UNIQUE(company_id) 제약 필요 — 없으면 INSERT만 수행)
    """
    sql = """
    INSERT INTO d_scores (
        company_id, score, grade, is_partial,
        patent_count, ipc_entropy, inventor_growth,
        rd_ratio, rd_growth, op_margin_slope,
        signal_score, calculated_at
    ) VALUES (
        %(company_id)s, %(score)s, %(grade)s, %(is_partial)s,
        %(patent_count)s, %(ipc_entropy)s, %(inventor_growth)s,
        %(rd_ratio)s, %(rd_growth)s, %(op_margin_slope)s,
        %(signal_score)s, %(calculated_at)s
    )
    ON CONFLICT (company_id) DO UPDATE SET
        score           = EXCLUDED.score,
        grade           = EXCLUDED.grade,
        is_partial      = EXCLUDED.is_partial,
        patent_count    = EXCLUDED.patent_count,
        ipc_entropy     = EXCLUDED.ipc_entropy,
        inventor_growth = EXCLUDED.inventor_growth,
        rd_ratio        = EXCLUDED.rd_ratio,
        rd_growth       = EXCLUDED.rd_growth,
        op_margin_slope = EXCLUDED.op_margin_slope,
        signal_score    = EXCLUDED.signal_score,
        calculated_at   = EXCLUDED.calculated_at
    ;
    """
    # _normalized는 DB 컬럼 없으므로 제거
    params = {k: v for k, v in result.items() if k != "_normalized"}

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()
    logger.info(f"[company_id={result['company_id']}] d_scores 테이블 저장 완료")


def ensure_unique_constraint() -> None:
    """
    d_scores.company_id 에 UNIQUE 제약이 없으면 추가.
    ON CONFLICT (company_id) DO UPDATE 를 쓰려면 필요.
    """
    sql = """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'uq_d_scores_company_id'
        ) THEN
            ALTER TABLE d_scores ADD CONSTRAINT uq_d_scores_company_id UNIQUE (company_id);
        END IF;
    END $$;
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
    logger.info("d_scores UNIQUE(company_id) 제약 확인 완료")


# ──────────────────────────────────────────────
# 파이프라인 (피처 계산 → 스코어 → DB 저장)
# ──────────────────────────────────────────────

def run_pipeline(company_ids: list[int] = None) -> list[dict]:
    """
    Phase 3 + Phase 4 통합 실행.
    1) 피처 계산
    2) D-Score 산출
    3) d_scores 테이블 저장
    """
    ensure_unique_constraint()

    if company_ids is None:
        company_ids = [3, 4, 5, 6, 7]   # 협력사 5개사

    # all_features = []
    # for cid in company_ids:
    #     try:
    #         all_features.append(compute_features(cid))
    #     except Exception as e:
    #         logger.error(f"[company_id={cid}] 피처 계산 실패: {e}")
    all_features = compute_all_features(company_ids)

    results = []
    for feat in all_features:
        try:
            result = calc_d_score(feat)
            upsert_d_score(result)
            results.append(result)
        except Exception as e:
            logger.error(f"[company_id={feat.get('company_id')}] D-Score 저장 실패: {e}")

    return results


def print_summary(results: list[dict]) -> None:
    """결과 콘솔 출력."""
    print("\n" + "=" * 60)
    print(f"{'회사ID':>6}  {'D-Score':>8}  {'등급':>4}  {'부분':>4}  {'특허':>5}  {'IPC엔트로피':>10}")
    print("-" * 60)
    for r in sorted(results, key=lambda x: x["score"], reverse=True):
        partial_mark = "⚠" if r["is_partial"] else "✓"
        print(
            f"{r['company_id']:>6}  "
            f"{r['score']:>8.4f}  "
            f"{r['grade']:>4}  "
            f"{partial_mark:>4}  "
            f"{r['patent_count']:>5}  "
            f"{r['ipc_entropy']:>10.4f}"
        )
    print("=" * 60)
    print("⚠ = is_partial=True (DART 재무 미수집, 특허 피처만 반영)\n")


# ──────────────────────────────────────────────
# 단독 실행
# ──────────────────────────────────────────────

if __name__ == "__main__":
    results = run_pipeline()
    print_summary(results)
