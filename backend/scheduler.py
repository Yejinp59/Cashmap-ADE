"""
야간 배치 수집 스케줄러
- 매일 새벽 2시 자동 실행
- DART 공시 수집 → DB 저장
- KIPRIS 특허 수집 → DB 저장
- 실행 로그 기록
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from database import SessionLocal
from datetime import date
import logging
import threading
import traceback

# 배치 동시 실행 방지용 Lock (수동 실행 + 야간 배치 충돌 차단)
_batch_lock = threading.Lock()

# ── 로거 설정 ──────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("batch.log", encoding="utf-8"),
    ]
)
logger = logging.getLogger("batch")


# ── DART 본문 수집 작업 ────────────────────────────
def collect_dart():
    """DART document.xml 본문 수집 → disclosures(청크) 적재. 기존 rcept_no는 skip."""
    logger.info("=== DART 본문 수집 시작 ===")
    db: Session = SessionLocal()

    try:
        from dart_body_collector import collect_bodies
        # 야간: 최근 30일 내 신규 정기보고서만 (이미 적재된 rcept_no는 자동 skip)
        res = collect_bodies(db, days=30, max_docs_per_corp=5, only_periodic=True)
        logger.info(
            "DART 본문 수집 완료 — %d건 / %d청크 (skip %d)",
            res["docs"], res["chunks"], res["skipped"],
        )

    except ImportError:
        logger.warning("dart_body_collector 미구현 — 스킵")

    except Exception as e:
        logger.error(f"DART 수집 실패: {e}")
        logger.error(traceback.format_exc())

    finally:
        db.close()


# ── KIPRIS 수집 작업 ───────────────────────────────
def collect_kipris():
    """KIPRIS Plus API에서 특허 데이터 수집 → DB 저장"""
    logger.info("=== KIPRIS 수집 시작 ===")
    db: Session = SessionLocal()

    try:
        from kipris_collector import fetch_and_save_patents
        count = fetch_and_save_patents(db)
        logger.info(f"KIPRIS 수집 완료 — {count}건 저장")

    except ImportError:
        logger.warning("kipris_collector 미구현 — 스킵 (API 키 발급 후 활성화)")

    except Exception as e:
        logger.error(f"KIPRIS 수집 실패: {e}")
        logger.error(traceback.format_exc())

    finally:
        db.close()


# ── AI 서사 리포트 선생성 작업 ─────────────────────
def pregenerate_narratives():
    """관리대상 기업들의 AI 서사 리포트(제언)를 미리 생성·저장.

    멘토 피드백 반영: 리포트는 RM이 '버튼으로 만드는' 것이 아니라
    '이미 만들어진 상태'로 제공돼야 함. 야간에 미리 돌려두면
    아침에 RM이 열 때 report_narratives 캐시에서 즉시 나온다.

    - main._gather_report / _attach_narrative 를 그대로 재사용(정본 로직).
      (scheduler ↔ main 순환참조 회피 위해 함수 안에서 지연 import)
    - _attach_narrative 가 input_hash 로 캐시 판단 → 신호가 바뀐 기업만
      실제 재생성, 나머지는 값싼 해시 비교 no-op.
    - Ollama 미설치 시 build_narrative 가 fallback(룰베이스)으로 graceful.
    - DART/KIPRIS 수집 '다음에' 호출해야 새 공시·신호가 반영됨.
    """
    logger.info("=== AI 서사 리포트 선생성 시작 ===")
    db: Session = SessionLocal()

    try:
        from main import _gather_report, _attach_narrative
        from models import Company

        companies = db.query(Company).all()
        ok = fail = 0
        for c in companies:
            try:
                d = _gather_report(db, c.id)
                _attach_narrative(db, d)   # 해시 변동 시에만 재생성 후 upsert
                ok += 1
            except Exception as e:
                fail += 1
                logger.warning("서사 선생성 실패 (company_id=%s): %s", c.id, e)

        logger.info(
            "AI 서사 선생성 완료 — 성공 %d / 실패 %d (총 %d개사)",
            ok, fail, len(companies),
        )

    except ImportError as e:
        logger.warning("서사 선생성 모듈 import 실패 — 스킵: %s", e)

    except Exception as e:
        logger.error(f"AI 서사 선생성 실패: {e}")
        logger.error(traceback.format_exc())

    finally:
        db.close()


# ── 전체 배치 작업 ─────────────────────────────────
def run_nightly_batch():
    """매일 새벽 2시 실행되는 전체 배치. Lock으로 동시 실행 방지."""
    if not _batch_lock.acquire(blocking=False):
        logger.warning("이미 다른 배치가 실행 중입니다 — 이번 호출은 스킵.")
        return False

    try:
        logger.info("========================================")
        logger.info(f"야간 배치 시작 — {date.today()}")
        logger.info("========================================")

        collect_dart()
        collect_kipris()
        pregenerate_narratives()   # 수집 결과 반영해 리포트 미리 생성

        logger.info("========================================")
        logger.info("야간 배치 완료")
        logger.info("========================================")
        return True
    finally:
        _batch_lock.release()


def is_batch_running() -> bool:
    """배치가 현재 실행 중인지 확인."""
    if _batch_lock.acquire(blocking=False):
        _batch_lock.release()
        return False
    return True


# ── 스케줄러 설정 ──────────────────────────────────
def create_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="Asia/Seoul")

    # 매일 새벽 2시 실행
    scheduler.add_job(
        func=run_nightly_batch,
        trigger=CronTrigger(hour=2, minute=0),
        id="nightly_batch",
        name="야간 배치 수집",
        replace_existing=True,
    )

    return scheduler


# ── 수동 즉시 실행 (테스트용) ─────────────────────
def run_now():
    """개발/테스트 시 즉시 실행"""
    logger.info("수동 배치 실행")
    run_nightly_batch()


if __name__ == "__main__":
    run_now()
