"""
5개사 D-Score 초안 시드 (ADE_Handoff_v3 §3·§4 기준).

AI-B(김성희)가 넘긴 5개사 D-Score 초안을 데모용으로 심어, 화면·리포트가
빈 상태가 아니라 실값으로 보이게 한다. 나중에 AI-B가 백테스팅 후 확정 가중치로
POST /api/ade/dscore/batch 재투입하면 company_id 기준으로 값만 갱신된다(멱등).

⚠️ 값 성격: 가중치·등급 임계값은 임시값, signal_score(S-Score)는 연동 전이라 None.
     inventor_count_yoy·rd_ratio·rd_growth 는 비율(%→소수)로 저장.

실행: cd backend && python seed_dscores.py
"""

from database import SessionLocal, engine
from models import Company, DScore

# corp_code 는 8자리 DART 고유번호 (종목코드 아님) — Handoff §4 검증 완료 목록
COMPANIES = [
    # (corp_code, corp_name, sector, is_anchor)
    ("00126380", "삼성전자",     "반도체",   True),   # 앵커 (대기업)
    ("00164779", "SK하이닉스",   "반도체",   True),   # 앵커 (대기업)
    ("01489648", "솔브레인",     "소재",     False),
    ("01365825", "피에스케이",   "장비",     False),
    ("00161383", "한미반도체",   "장비",     False),
    ("00468374", "원익QnC",      "소재",     False),
    ("00244747", "파크시스템스", "장비",     False),
]

# Handoff §3 — 5개사 D-Score 결과 (전부 is_partial=False, signal_score=None)
# (corp_code, d_score, grade, active_patents, inventor_count_yoy, rd_ratio, rd_growth, op_margin_slope)
DSCORES = [
    ("01489648", 0.6874, "POSITIVE", 309, -0.137, 0.0444,  0.294, -0.0067),  # 솔브레인
    ("01365825", 0.5745, "POSITIVE", 101,  0.686, 0.0780, -0.103,  0.0199),  # 피에스케이
    ("00161383", 0.4818, "MONITOR",   48,  0.200, 0.0336,  0.086,  0.1093),  # 한미반도체
    ("00468374", 0.4694, "MONITOR",   37,  0.250, 0.0257,  0.174, -0.0199),  # 원익QnC
    ("00244747", 0.4259, "MONITOR",   12,  0.000, 0.1120, -0.074,  0.0074),  # 파크시스템스
]


def seed():
    # BE 다리 테이블 보장 생성 (앱 부팅 없이 스크립트 단독 실행 대비)
    Company.__table__.create(bind=engine, checkfirst=True)
    DScore.__table__.create(bind=engine, checkfirst=True)

    db = SessionLocal()
    try:
        # 1) 회사: 없는 것만 insert (기존 행은 팀원 데이터일 수 있어 건드리지 않음) → id 확보
        code_to_id = {}
        for corp_code, corp_name, sector, is_anchor in COMPANIES:
            co = db.query(Company).filter(Company.corp_code == corp_code).first()
            if not co:
                co = Company(
                    corp_code=corp_code, corp_name=corp_name,
                    sector=sector, is_anchor=is_anchor, is_listed=True,
                )
                db.add(co)
                db.flush()      # id 채우기
            code_to_id[corp_code] = co.id
        db.commit()

        # 2) D-Score upsert (company_id 기준)
        n = 0
        for (corp_code, d_score, grade, patents,
             inv_yoy, rd_ratio, rd_growth, op_slope) in DSCORES:
            cid = code_to_id[corp_code]
            row = db.query(DScore).filter(DScore.company_id == cid).first()
            vals = dict(
                company_id=cid, corp_code=corp_code,
                d_score=d_score, grade=grade,
                active_patents=patents, ipc_entropy=None,
                inventor_count_yoy=inv_yoy, rd_ratio=rd_ratio,
                rd_growth=rd_growth, op_margin_slope=op_slope,
                signal_score=None, is_partial=False,
            )
            if row:
                for k, v in vals.items():
                    setattr(row, k, v)
            else:
                db.add(DScore(**vals))
            n += 1
        db.commit()

        print(f"[seed] 회사 {len(COMPANIES)}건, D-Score {n}건 upsert 완료")
        for r in db.query(DScore).order_by(DScore.d_score.desc()).all():
            co = db.query(Company).filter(Company.id == r.company_id).first()
            print(f"  - {co.corp_name:<10} {r.d_score:.4f} {r.grade:<8} 특허 {r.active_patents}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
