"""
SQLAlchemy 모델 — 팀원 Supabase DB(프로젝트 base)에 정렬됨.

⚠️ 스키마 출처 구분
  - 팀원 데이터 테이블: disclosures(청크 단위), embeddings, signal_scores,
    company_financials, supply_chain_edges  → 컬럼은 팀원 DB 실제 구조 그대로.
  - 우리(BE)가 추가한 다리 테이블: users(로그인/RBAC), companies(id ↔ corp_code),
    report_narratives(리포트 서사 캐시), d_scores(AI-B D-Score 적재 슬롯).

Patent 테이블은 팀원 DB에 없어 제거함(AI-B가 특허 원본은 자체 DB에서 관리).
d_scores는 AI-B가 산출값을 투입하는 BE 소유 슬롯 (ADE_Handoff_v3 §7 스키마 준수).
"""

from sqlalchemy import (
    Column, Integer, BigInteger, String, Boolean, Float, Date, Text,
    DateTime, ForeignKey, CheckConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from database import Base


# ── 우리가 추가한 다리 테이블 ─────────────────────────
class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    emp_id     = Column(String(20), unique=True, nullable=False)
    password   = Column(String(255), nullable=False)
    role       = Column(String(20), nullable=False)
    name       = Column(String(50), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Company(Base):
    """id ↔ corp_code 다리. 팀원 데이터는 corp_code로 키잉되므로 corp_code가 조인 키."""
    __tablename__ = "companies"

    id         = Column(Integer, primary_key=True, index=True)
    corp_code  = Column(String(20), unique=True)
    corp_name  = Column(String(100), nullable=False)
    biz_no     = Column(String(20))
    is_listed  = Column(Boolean, default=False)
    is_anchor  = Column(Boolean, default=False)
    sector     = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())


class ReportNarrative(Base):
    """RM 리포트 AI 서사(제언) 캐시 — BE 소유 다리 테이블.
    멘토 피드백 반영: 리포트는 '버튼으로 생성'이 아니라 '미리 만들어져 제공'.
    야간 배치/첫 열람 시 생성→저장 후 즉시 제공. input_hash가 바뀌면 재생성.
    sections = {headline, diagnosis, action, rationale, risk} (모두 한국어 plain text)."""
    __tablename__ = "report_narratives"

    id           = Column(Integer, primary_key=True, index=True)
    company_id   = Column(Integer, unique=True, nullable=False, index=True)
    corp_code    = Column(String(20))
    sections     = Column(JSONB, nullable=False)
    model        = Column(String(50))    # 생성 모델명 또는 'fallback'
    input_hash   = Column(String(64))    # 입력 신호 해시 (재생성 판단)
    generated_at = Column(DateTime, server_default=func.now())


class DScore(Base):
    """ADE D-Score 결과 — AI-B(김성희) 산출, BE는 저장/제공 슬롯만 담당.
    통합 DB 미확정(로컬 Docker vs Supabase) 상태라 BE 소유 다리 테이블로 관리:
    AI-B가 POST /api/ade/dscore(/batch)로 결과를 투입하면 UNIQUE(company_id) 기준 upsert.

    피처: ADE 6개(active_patents/ipc_entropy/inventor_count_yoy/rd_ratio/rd_growth/
    op_margin_slope)는 완성값, signal_score(CashMap S-Score)는 연동 전이라 None 가능.
    가중치·등급 임계값은 백테스팅 전 임시값 → d_score/grade는 이후 재계산되어 재투입됨.
    grade: POSITIVE(숨은진주) / MONITOR(모니터링) / NEGATIVE(거품경보)."""
    __tablename__ = "d_scores"
    __table_args__ = (
        CheckConstraint(
            "grade IN ('POSITIVE','MONITOR','NEGATIVE')",
            name="ck_d_scores_grade",
        ),
    )

    id                 = Column(Integer, primary_key=True, index=True)
    company_id         = Column(Integer, unique=True, nullable=False, index=True)
    corp_code          = Column(String(20))
    d_score            = Column(Float, nullable=False)
    grade              = Column(String(20), nullable=False)
    # ADE 6개 피처 (완성값)
    active_patents     = Column(Integer)
    ipc_entropy        = Column(Float)
    inventor_count_yoy = Column(Float)   # 발명자 풀 YoY (비율)
    rd_ratio           = Column(Float)
    rd_growth          = Column(Float)
    op_margin_slope    = Column(Float)
    # CashMap 연동 피처 (S-Score 동결 전이라 None 가능)
    signal_score       = Column(Float)
    is_partial         = Column(Boolean, default=False)  # 피처 일부 결측 여부
    created_at         = Column(DateTime, server_default=func.now())
    updated_at         = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ── 팀원 데이터 테이블 (실제 구조 그대로) ─────────────
class Disclosure(Base):
    """공시 '청크' 단위 행. 공시 1건(rcept_no)이 여러 청크로 쪼개져 있음."""
    __tablename__ = "disclosures"

    id            = Column(Integer, primary_key=True, index=True)
    corp_code     = Column(String, nullable=False)
    corp_name     = Column(String, nullable=False)
    rcept_no      = Column(String, nullable=False)        # DART 접수번호 (공시 1건 식별)
    report_type   = Column(String, nullable=False)
    rcept_dt      = Column(Date, nullable=False)
    section_title = Column(String)
    chunk_index   = Column(Integer)
    raw_text      = Column(Text, nullable=False)
    token_count   = Column(Integer)
    created_at    = Column(DateTime, server_default=func.now())


class Embedding(Base):
    """청크 임베딩 (disclosures 와 1:1). vector 컬럼은 지금 단계에선 ORM 매핑 생략."""
    __tablename__ = "embeddings"

    id            = Column(Integer, primary_key=True, index=True)
    disclosure_id = Column(Integer, ForeignKey("disclosures.id"))
    created_at    = Column(DateTime, server_default=func.now())


class SignalScore(Base):
    """공시(rcept_no) 단위 신호 강도. AI-A 산출. category_scores 에 카테고리별 가중 분해."""
    __tablename__ = "signal_scores"

    id              = Column(Integer, primary_key=True, index=True)
    corp_code       = Column(String, nullable=False)
    rcept_dt        = Column(Date, nullable=False)
    rcept_no        = Column(String, nullable=False)
    s_score         = Column(Float, nullable=False)
    category_scores = Column(JSONB)
    created_at      = Column(DateTime, server_default=func.now())


class CompanyFinancial(Base):
    __tablename__ = "company_financials"

    id               = Column(Integer, primary_key=True, index=True)
    corp_code        = Column(String, nullable=False)
    corp_name        = Column(String, nullable=False)
    period           = Column(String, nullable=False)
    revenue          = Column(BigInteger)
    operating_profit = Column(BigInteger)
    rd_expense       = Column(BigInteger)
    capex            = Column(BigInteger)
    created_at       = Column(DateTime, server_default=func.now())


class SupplyChainEdge(Base):
    """공급망 관계. 팀원 구조: corp_name 문자열 기반(parent/child)."""
    __tablename__ = "supply_chain_edges"

    id              = Column(Integer, primary_key=True, index=True)
    parent_corp     = Column(String, nullable=False)
    child_corp      = Column(String, nullable=False)
    child_corp_code = Column(String)
    edge_weight     = Column(Float)
    tier            = Column(Integer, nullable=False)
    source          = Column(String)
    created_at      = Column(DateTime, server_default=func.now())
