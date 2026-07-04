from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from datetime import datetime, date


# ── Company ──────────────────────────────────────────
class CompanyBase(BaseModel):
    corp_name: str
    sector:    Optional[str] = None
    is_listed: bool = False
    is_anchor: bool = False

class CompanyCreate(CompanyBase):
    corp_code: Optional[str] = None
    biz_no:    Optional[str] = None

class CompanyResponse(CompanyBase):
    id:         int
    corp_code:  Optional[str]
    created_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


# ── SignalScore (팀원 스키마: 공시 단위 신호) ─────────
class SignalScoreResponse(BaseModel):
    id:              int
    corp_code:       str
    corp_name:       Optional[str] = None     # companies 조인으로 채움
    rcept_no:        str
    rcept_dt:        date
    s_score:         float
    category_scores: Optional[Any] = None

    model_config = ConfigDict(from_attributes=True)


class SignalSummary(BaseModel):
    """대시보드 요약 카드용 — 회사별 최신 신호 + 트렌드."""
    corp_code:    str
    company_id:   Optional[int] = None
    company_name: str
    latest_score: float
    scored_at:    date
    trend:        str   # UP / DOWN / STABLE


class SignalTrendPoint(BaseModel):
    """차트용 한 점 — 한 회사의 한 시점 신호."""
    date:      date
    corp_code: str
    name:      str
    score:     float


# ── Disclosure: 청크 단위 (원시 행) ───────────────────
class DisclosureResponse(BaseModel):
    id:            int
    corp_code:     str
    corp_name:     Optional[str]
    rcept_no:      str
    report_type:   Optional[str]
    rcept_dt:      date
    section_title: Optional[str]
    chunk_index:   Optional[int]
    token_count:   Optional[int]

    model_config = ConfigDict(from_attributes=True)


class DisclosureDetailResponse(DisclosureResponse):
    raw_text: Optional[str]


# ── Disclosure: 문서 단위 (rcept_no 로 청크를 묶음 — 뷰어용) ──
class DisclosureDocSummary(BaseModel):
    """공시 목록 한 줄 — 공시 1건(rcept_no) 요약."""
    id:          str               # = rcept_no (프론트 네비게이션 키)
    rcept_no:    str
    corp_code:   str
    corp_name:   Optional[str] = None
    report_type: Optional[str] = None
    rcept_dt:    date
    title:       str
    chunk_count: int
    s_score:     Optional[float] = None     # 문서 단위 신호 강도


class DisclosureSection(BaseModel):
    section_title: Optional[str] = None
    text:          str


class SimilarDisclosure(BaseModel):
    """임베딩 유사도 기반 '비슷한 공시' 한 건."""
    rcept_no:   str
    corp_code:  Optional[str] = None
    corp_name:  Optional[str] = None
    rcept_dt:   Optional[date] = None
    title:      str
    similarity: float          # 0.0~1.0 코사인 유사도
    s_score:    Optional[float] = None


class DisclosureDocDetail(BaseModel):
    """공시 뷰어용 — 청크를 합친 전체 본문 + 섹션 + 신호."""
    id:              str           # = rcept_no
    rcept_no:        str
    corp_code:       str
    corp_name:       Optional[str] = None
    report_type:     Optional[str] = None
    rcept_dt:        date
    title:           str
    content:         str           # 청크를 chunk_index 순으로 합친 본문
    sections:        list[DisclosureSection] = []
    signal_score:    Optional[float] = None
    category_scores: Optional[Any] = None
    highlights:      list = []      # 청크별 하이라이트는 AI-A 대기 → 빈 배열


# ── D-Score (ADE — AI-B 산출 결과 적재/제공) ──────────
class DScoreCreate(BaseModel):
    """AI-B가 POST /api/ade/dscore(/batch)로 투입하는 형태.
    company_id 기준 upsert (UNIQUE). grade: POSITIVE/MONITOR/NEGATIVE."""
    company_id:         int
    corp_code:          Optional[str] = None
    d_score:            float
    grade:              str
    active_patents:     Optional[int]   = None
    ipc_entropy:        Optional[float] = None
    inventor_count_yoy: Optional[float] = None
    rd_ratio:           Optional[float] = None
    rd_growth:          Optional[float] = None
    op_margin_slope:    Optional[float] = None
    signal_score:       Optional[float] = None
    is_partial:         bool = False


class DScoreResponse(BaseModel):
    id:                 int
    company_id:         int
    corp_code:          Optional[str] = None
    corp_name:          Optional[str] = None    # companies 조인으로 채움
    d_score:            float
    grade:              str
    active_patents:     Optional[int]   = None
    ipc_entropy:        Optional[float] = None
    inventor_count_yoy: Optional[float] = None
    rd_ratio:           Optional[float] = None
    rd_growth:          Optional[float] = None
    op_margin_slope:    Optional[float] = None
    signal_score:       Optional[float] = None
    is_partial:         bool = False
    updated_at:         Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ── 리포트 AI 서사 생성 (프론트 구조화 신호 → EXAONE) ──
class NarrativeGenRequest(BaseModel):
    """프론트(리포트 화면)가 표시 중인 기업의 구조화 신호를 그대로 보내면,
    백엔드가 Ollama/EXAONE 로 RM 제언 서사를 생성해 돌려준다(룰베이스 fallback).
    company_id 없이도 동작(데모 목업 기업 포함) — 입력 해시로 캐시."""
    corp_name:   str
    sector:      Optional[str]   = None
    is_listed:   bool            = True
    grade:       Optional[str]   = None   # POSITIVE/MONITOR/NEGATIVE
    d_score:     Optional[float] = None   # 0~100(목업) 또는 0~1
    signal:      Optional[float] = None   # 0~100(목업) 또는 0~1
    discrepancy: Optional[float] = None   # 공시-행동 괴리(p)
    theme:       Optional[str]   = None   # 대기업 테마
    anchor:      Optional[str]   = None   # 발신 대기업명
    tier:        Optional[int]   = None
    facts:       Optional[list[str]] = None  # ["특허 수 412건", "R&D 비중 11.4%", ...]
    regenerate:  bool            = False


class ReverseSectorOption(BaseModel):
    key:   str
    label: str
    hint:  Optional[str] = None


class ReverseInterpretRequest(BaseModel):
    """역방향 조회: 사용자 자유 질의에서 EXAONE 로 키워드 추출 + 후보 산업 시나리오 분류.
    프론트가 후보 시나리오(key/label/hint)를 함께 보내면, 백엔드는 데이터 무지(agnostic)로 매칭만."""
    query:   str
    sectors: list[ReverseSectorOption]


class DisclosureSummaryRequest(BaseModel):
    """데모 공시(원문 rcept_no 없음)를 EXAONE 로 RM 관점 요약.
    화면이 가진 제목·발췌·유형·키워드 + 기업 맥락을 보내면 요약을 돌려준다(룰베이스 fallback)."""
    corp_name:  Optional[str]       = None
    sector:     Optional[str]       = None
    grade:      Optional[str]       = None
    theme:      Optional[str]       = None   # 연관 대기업 테마
    title:      str
    doc_type:   Optional[str]       = None   # 공시 유형
    signal:     Optional[str]       = None   # action / plan / routine
    excerpt:    Optional[str]       = None   # 원문 발췌(짧음)
    keywords:   Optional[list[str]] = None
    regenerate: bool                = False


# ── Reverse Query (자연어 검색 — BGE-M3 대기, 임시) ───
class ReverseQueryRequest(BaseModel):
    query: str

class ReverseQueryResult(BaseModel):
    rank:         int
    corp_code:    str
    company_name: str
    score:        float
    score_reason: str


# ── Supply Chain ──────────────────────────────────────
class SupplyChainEdgeResponse(BaseModel):
    id:              int
    parent_corp:     str
    child_corp:      str
    child_corp_code: Optional[str]
    tier:            int
    source:          Optional[str]
    edge_weight:     Optional[float]

    model_config = ConfigDict(from_attributes=True)


# ── Network Graph (프론트 Force Graph용) ──────────────
class NetworkNode(BaseModel):
    id:        str            # corp_code (앵커도 corp_code)
    name:      str
    is_anchor: bool
    sector:    Optional[str] = None

class NetworkEdge(BaseModel):
    source: str
    target: str
    tier:   int
    weight: Optional[float] = None

class NetworkGraphResponse(BaseModel):
    nodes: list[NetworkNode]
    edges: list[NetworkEdge]


# ── Auth ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    emp_id:   str
    password: str

class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    role:          str
    name:          str

class RefreshRequest(BaseModel):
    refresh_token: str

class AccessTokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"

class UserResponse(BaseModel):
    id:     int
    emp_id: str
    role:   str
    name:   str

    model_config = ConfigDict(from_attributes=True)

class UserCreate(BaseModel):
    emp_id:   str
    password: str
    role:     str
    name:     str
