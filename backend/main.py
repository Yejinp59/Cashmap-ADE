"""
CashMap × ADE API — 팀원 Supabase DB(base)에 정렬됨.

현재 살아있는 실데이터: signal_scores(공시 단위 신호), disclosures(청크), companies/users.
d_scores: AI-B가 POST /api/ade/dscore(/batch)로 투입하는 BE 소유 슬롯 (5개사 초안 반영).
미존재(graceful 처리): patents(특허 원본은 AI-B 자체 DB), 자연어 역방향검색(BGE-M3 대기),
company_financials·supply_chain_edges(데이터 0행).
"""

import os
import json
import hashlib
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import quote

import requests

from fastapi import FastAPI, Depends, HTTPException, Query, status, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, func
from sqlalchemy.orm import Session

from database import get_db, engine
from models import (
    Company, SignalScore, Disclosure, User, SupplyChainEdge, CompanyFinancial,
    ReportNarrative, DScore,
)
from schemas import (
    CompanyResponse, CompanyCreate,
    SignalScoreResponse, SignalSummary, SignalTrendPoint,
    DisclosureResponse,
    DisclosureDocSummary, DisclosureDocDetail, DisclosureSection,
    SimilarDisclosure,
    DScoreCreate, DScoreResponse,
    NarrativeGenRequest,
    DisclosureSummaryRequest,
    ReverseInterpretRequest,
    ReverseQueryRequest, ReverseQueryResult,
    SupplyChainEdgeResponse,
    NetworkGraphResponse, NetworkNode, NetworkEdge,
    LoginRequest, TokenResponse, RefreshRequest, AccessTokenResponse,
    UserResponse, UserCreate,
)
from scheduler import create_scheduler
from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_token, get_current_user, require_role,
)
from report_builder import ReportData, build_pdf, build_recommendation
from report_narrative import build_narrative, narrative_input_hash, build_disclosure_summary, build_reverse_interpretation

AI_INGEST_ROLES = ("ROLE_ADMIN",)
READ_ROLES      = ("ROLE_RM", "ROLE_IB", "ROLE_AUDIT", "ROLE_ADMIN")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # BE 소유 다리 테이블(report_narratives, d_scores)만 보장 생성 (팀원 테이블은 건드리지 않음)
    try:
        ReportNarrative.__table__.create(bind=engine, checkfirst=True)
        DScore.__table__.create(bind=engine, checkfirst=True)
        print("[startup] report_narratives / d_scores 테이블 확인/생성 완료")
    except Exception as e:
        print(f"[startup] BE 다리 테이블 생성 건너뜀: {e}")
    scheduler = create_scheduler()
    scheduler.start()
    print("[startup] 야간 배치 스케줄러 시작 (매일 02:00 KST)")
    yield
    scheduler.shutdown()
    print("[shutdown] 스케줄러 종료")


app = FastAPI(
    title="CashMap × ADE API",
    description="AI 기반 선제 여신 인텔리전스 플랫폼",
    version="2.0.0",
    lifespan=lifespan,
)

CORS_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── 공통 헬퍼 ─────────────────────────────────────────
def _company_map(db: Session) -> dict:
    """corp_code → Company 매핑 (조인 대신 메모리 매핑으로 corp_name/sector 보강)."""
    return {c.corp_code: c for c in db.query(Company).all()}


def _resolve_company(db: Session, company_id: int) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="기업을 찾을 수 없습니다.")
    return company


# ── 기본 ──────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "service": "CashMap × ADE API"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB 연결 실패: {str(e)}")


# ── Companies ─────────────────────────────────────────
@app.get("/api/companies", response_model=List[CompanyResponse])
def get_companies(
    is_anchor: Optional[bool] = None,
    sector:    Optional[str]  = None,
    db: Session = Depends(get_db),
):
    query = db.query(Company)
    if is_anchor is not None:
        query = query.filter(Company.is_anchor == is_anchor)
    if sector:
        query = query.filter(Company.sector == sector)
    return query.order_by(Company.id).all()


@app.get("/api/companies/{company_id}", response_model=CompanyResponse)
def get_company(company_id: int, db: Session = Depends(get_db)):
    return _resolve_company(db, company_id)


@app.post("/api/companies", response_model=CompanyResponse)
def create_company(
    body: CompanyCreate,
    db:   Session = Depends(get_db),
    _:    User    = Depends(require_role(*AI_INGEST_ROLES)),
):
    company = Company(**body.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


# ══════════════════════════════════════════════════════
# CashMap 신호 강도 (signal_scores — 핵심 실데이터)
# ══════════════════════════════════════════════════════
def _signal_to_response(s: SignalScore, cmap: dict) -> SignalScoreResponse:
    co = cmap.get(s.corp_code)
    return SignalScoreResponse(
        id=s.id, corp_code=s.corp_code,
        corp_name=co.corp_name if co else s.corp_code,
        rcept_no=s.rcept_no, rcept_dt=s.rcept_dt,
        s_score=s.s_score, category_scores=s.category_scores,
    )


@app.get("/api/cashmap/signal", response_model=List[SignalScoreResponse])
def get_signals(
    sector: Optional[str] = None,
    corp_code: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """공시 단위 신호 목록 (최신순). sector/corp_code 필터 가능."""
    cmap = _company_map(db)
    query = db.query(SignalScore)
    if corp_code:
        query = query.filter(SignalScore.corp_code == corp_code)
    if sector:
        codes = [c.corp_code for c in cmap.values() if c.sector == sector]
        query = query.filter(SignalScore.corp_code.in_(codes or ["__none__"]))
    rows = (
        query.order_by(SignalScore.rcept_dt.desc(), SignalScore.id.desc())
        .limit(limit).all()
    )
    return [_signal_to_response(s, cmap) for s in rows]


@app.get("/api/cashmap/signal/summary", response_model=List[SignalSummary])
def get_signal_summary(db: Session = Depends(get_db)):
    """회사별 최신 신호 + 직전 대비 트렌드(UP/DOWN/STABLE)."""
    rn = func.row_number().over(
        partition_by=SignalScore.corp_code,
        order_by=(SignalScore.rcept_dt.desc(), SignalScore.id.desc()),
    ).label("rn")
    ranked = db.query(
        SignalScore.corp_code.label("corp_code"),
        SignalScore.s_score.label("s_score"),
        SignalScore.rcept_dt.label("rcept_dt"),
        rn,
    ).subquery()

    rows = (
        db.query(ranked.c.corp_code, ranked.c.s_score, ranked.c.rcept_dt, ranked.c.rn)
        .filter(ranked.c.rn <= 2)
        .order_by(ranked.c.corp_code, ranked.c.rn)
        .all()
    )

    cmap = _company_map(db)
    by_corp: dict[str, list] = {}
    for corp_code, s_score, rcept_dt, rn_val in rows:
        by_corp.setdefault(corp_code, []).append((rn_val, s_score, rcept_dt))

    result = []
    for corp_code, items in by_corp.items():
        items.sort(key=lambda x: x[0])     # rn asc → 최신이 [0]
        _, latest, latest_at = items[0]
        prev = items[1][1] if len(items) > 1 else None
        if prev is None or abs(latest - prev) < 0.02:
            trend = "STABLE"
        elif latest > prev:
            trend = "UP"
        else:
            trend = "DOWN"
        co = cmap.get(corp_code)
        result.append(SignalSummary(
            corp_code=corp_code,
            company_id=co.id if co else None,
            company_name=co.corp_name if co else corp_code,
            latest_score=latest, scored_at=latest_at, trend=trend,
        ))
    return result


@app.get("/api/cashmap/signal/trend", response_model=List[SignalTrendPoint])
def get_signal_trend(db: Session = Depends(get_db)):
    """시계열 추이 차트용 — 회사별 모든 시점 신호를 시간순으로."""
    cmap = _company_map(db)
    rows = (
        db.query(SignalScore)
        .order_by(SignalScore.rcept_dt, SignalScore.id)
        .all()
    )
    out = []
    for s in rows:
        co = cmap.get(s.corp_code)
        out.append(SignalTrendPoint(
            date=s.rcept_dt, corp_code=s.corp_code,
            name=co.corp_name if co else s.corp_code, score=s.s_score,
        ))
    return out


# ══════════════════════════════════════════════════════
# 공시 (disclosures — 청크를 rcept_no 단위 '문서'로 묶어 제공)
# ══════════════════════════════════════════════════════
def _doc_title(report_type: Optional[str], section_title: Optional[str], rcept_dt) -> str:
    """report_type 우선, 없으면 첫 섹션 제목, 그것도 없으면 '공시'."""
    label = (report_type or "").strip() or (section_title or "").strip() or "공시"
    if len(label) > 40:
        label = label[:40] + "…"
    return f"{label} ({rcept_dt})"


def _signal_map_by_rcept(db: Session, corp_code: Optional[str] = None) -> dict:
    q = db.query(SignalScore.rcept_no, SignalScore.s_score)
    if corp_code:
        q = q.filter(SignalScore.corp_code == corp_code)
    return {rcept_no: s for rcept_no, s in q.all()}


@app.get("/api/disclosures", response_model=List[DisclosureResponse])
def get_disclosures(
    corp_code: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """원시 청크 목록 (디버그/내부용)."""
    query = db.query(Disclosure)
    if corp_code:
        query = query.filter(Disclosure.corp_code == corp_code)
    return (
        query.order_by(Disclosure.rcept_dt.desc(), Disclosure.chunk_index)
        .limit(limit).all()
    )


@app.get("/api/cashmap/disclosures/{company_id}", response_model=List[DisclosureDocSummary])
def get_company_disclosures(
    company_id: int,
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """기업별 공시 '문서' 목록 — 같은 rcept_no 청크를 1건으로 묶음."""
    company = _resolve_company(db, company_id)
    chunks = (
        db.query(Disclosure)
        .filter(Disclosure.corp_code == company.corp_code)
        .all()
    )
    sig = _signal_map_by_rcept(db, company.corp_code)

    docs: dict[str, dict] = {}
    for c in chunks:
        d = docs.get(c.rcept_no)
        if d is None:
            d = docs[c.rcept_no] = {
                "rcept_no": c.rcept_no, "report_type": c.report_type,
                "rcept_dt": c.rcept_dt, "chunk_count": 0,
                "min_idx": None, "section_title": None,
            }
        d["chunk_count"] += 1
        if c.rcept_dt > d["rcept_dt"]:
            d["rcept_dt"] = c.rcept_dt
        idx = c.chunk_index if c.chunk_index is not None else 0
        if d["min_idx"] is None or idx < d["min_idx"]:
            d["min_idx"] = idx
            d["section_title"] = c.section_title
            d["report_type"] = c.report_type

    summaries = [
        DisclosureDocSummary(
            id=d["rcept_no"], rcept_no=d["rcept_no"],
            corp_code=company.corp_code, corp_name=company.corp_name,
            report_type=d["report_type"], rcept_dt=d["rcept_dt"],
            title=_doc_title(d["report_type"], d["section_title"], d["rcept_dt"]),
            chunk_count=d["chunk_count"], s_score=sig.get(d["rcept_no"]),
        )
        for d in docs.values()
    ]
    summaries.sort(key=lambda s: s.rcept_dt, reverse=True)
    return summaries[:limit]


@app.get("/api/disclosures/{rcept_no}", response_model=DisclosureDocDetail)
def get_disclosure(rcept_no: str, db: Session = Depends(get_db)):
    """공시 1건(rcept_no)의 청크를 합쳐 전체 본문 + 섹션 + 신호 반환 — 뷰어용."""
    chunks = (
        db.query(Disclosure)
        .filter(Disclosure.rcept_no == rcept_no)
        .order_by(Disclosure.chunk_index)
        .all()
    )
    if not chunks:
        raise HTTPException(status_code=404, detail="공시를 찾을 수 없습니다.")

    sections, parts, prev_title = [], [], None
    for c in chunks:
        text = c.raw_text or ""
        sections.append(DisclosureSection(section_title=c.section_title, text=text))
        # 원본에 이미 【】가 있으면 벗겨서 이중 괄호 방지
        title = (c.section_title or "").strip().strip("【】").strip()
        if title and title != prev_title:
            parts.append(f"【{title}】")
            prev_title = title
        parts.append(text)
    content = "\n\n".join(p for p in parts if p)

    head = chunks[0]
    co = db.query(Company).filter(Company.corp_code == head.corp_code).first()
    sig = (
        db.query(SignalScore)
        .filter(SignalScore.rcept_no == rcept_no)
        .order_by(SignalScore.rcept_dt.desc())
        .first()
    )
    return DisclosureDocDetail(
        id=rcept_no, rcept_no=rcept_no, corp_code=head.corp_code,
        corp_name=co.corp_name if co else head.corp_name,
        report_type=head.report_type, rcept_dt=head.rcept_dt,
        title=_doc_title(head.report_type, head.section_title, head.rcept_dt),
        content=content, sections=sections,
        signal_score=sig.s_score if sig else None,
        category_scores=sig.category_scores if sig else None,
        highlights=[],
    )


# ── 공시 AI 요약 (로컬 LLM via Ollama) — 요청 #3 ──
OLLAMA_URL   = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "exaone3.5:2.4b")
_SUMMARY_CACHE: dict = {}


@app.post("/api/disclosures/{rcept_no}/summary")
def summarize_disclosure(rcept_no: str, db: Session = Depends(get_db)):
    """공시 원문(청크 합본)을 로컬 LLM으로 한국어 plain-text 요약.
    Ollama 미연결/모델 미설치 시 503으로 graceful 처리(설치 안내 포함)."""
    if rcept_no in _SUMMARY_CACHE:
        return {"rcept_no": rcept_no, "model": OLLAMA_MODEL, "summary": _SUMMARY_CACHE[rcept_no], "cached": True}

    chunks = (
        db.query(Disclosure)
        .filter(Disclosure.rcept_no == rcept_no)
        .order_by(Disclosure.chunk_index)
        .all()
    )
    if not chunks:
        raise HTTPException(status_code=404, detail="공시를 찾을 수 없습니다.")
    body = "\n".join((c.raw_text or "") for c in chunks).strip()
    if not body:
        raise HTTPException(status_code=422, detail="요약할 본문이 없습니다.")
    body = body[:6000]   # 소형 모델 컨텍스트/속도 보호

    prompt = (
        "다음은 한국 기업의 전자공시(DART) 본문입니다. 핵심을 한국어 plain text로 3~4문장으로 "
        "간결히 요약하세요. 투자·특허·증설·수주·계약 등 실제 '행동'에 해당하는 사실을 우선하고, "
        "마크다운/불릿/머리말 없이 줄글로만 쓰세요.\n\n=== 공시 본문 ===\n"
        + body + "\n\n=== 요약 ===\n"
    )
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL, "prompt": prompt, "stream": False,
                "options": {"temperature": 0.2, "num_predict": 320},
            },
            timeout=120,
        )
    except requests.exceptions.RequestException:
        raise HTTPException(
            status_code=503,
            detail=(f"로컬 LLM(Ollama)에 연결할 수 없습니다. `ollama serve` 실행 후 "
                    f"`ollama pull {OLLAMA_MODEL}` 로 모델을 받아주세요. (대상: {OLLAMA_URL})"),
        )
    if resp.status_code == 404:
        raise HTTPException(status_code=503, detail=f"모델 '{OLLAMA_MODEL}' 미설치 — `ollama pull {OLLAMA_MODEL}` 필요.")
    if not resp.ok:
        raise HTTPException(status_code=502, detail=f"LLM 응답 오류 (HTTP {resp.status_code}).")

    summary = (resp.json().get("response") or "").strip()
    if not summary:
        raise HTTPException(status_code=502, detail="LLM이 빈 응답을 반환했습니다.")
    _SUMMARY_CACHE[rcept_no] = summary
    return {"rcept_no": rcept_no, "model": OLLAMA_MODEL, "summary": summary, "cached": False}


# ── 비슷한 공시 추천 (pgvector — 문서 centroid 코사인) ──
_SIMILAR_SQL = text("""
WITH doc_vec AS (
  SELECT d.rcept_no AS rcept_no, AVG(e.embedding) AS v
  FROM embeddings e JOIN disclosures d ON d.id = e.disclosure_id
  GROUP BY d.rcept_no
),
target AS (SELECT v FROM doc_vec WHERE rcept_no = :rcept_no)
SELECT dv.rcept_no, (1 - (dv.v <=> t.v)) AS similarity
FROM doc_vec dv, target t
WHERE dv.rcept_no <> :rcept_no
ORDER BY dv.v <=> t.v ASC
LIMIT :limit
""")


@app.get("/api/disclosures/{rcept_no}/similar", response_model=List[SimilarDisclosure])
def get_similar_disclosures(
    rcept_no: str,
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """대상 공시와 임베딩이 비슷한 다른 공시 — 청크 임베딩 평균(centroid) 코사인."""
    rows = db.execute(_SIMILAR_SQL, {"rcept_no": rcept_no, "limit": limit}).fetchall()
    if not rows:
        return []
    rcept_nos = [r[0] for r in rows]
    sim_map = {r[0]: float(r[1]) for r in rows}

    chunks = db.query(Disclosure).filter(Disclosure.rcept_no.in_(rcept_nos)).all()
    heads: dict[str, Disclosure] = {}
    for c in chunks:
        h = heads.get(c.rcept_no)
        if h is None or (c.chunk_index or 0) < (h.chunk_index or 0):
            heads[c.rcept_no] = c
    sig = {
        s.rcept_no: s.s_score
        for s in db.query(SignalScore).filter(SignalScore.rcept_no.in_(rcept_nos)).all()
    }
    cmap = _company_map(db)

    out = []
    for rn in rcept_nos:           # SQL 순서(유사도 내림차순) 유지
        h = heads.get(rn)
        co = cmap.get(h.corp_code) if h else None
        out.append(SimilarDisclosure(
            rcept_no=rn,
            corp_code=h.corp_code if h else None,
            corp_name=(co.corp_name if co else (h.corp_name if h else None)),
            rcept_dt=h.rcept_dt if h else None,
            title=_doc_title(h.report_type, h.section_title, h.rcept_dt) if h else rn,
            similarity=round(sim_map.get(rn, 0.0), 4),
            s_score=sig.get(rn),
        ))
    return out


# ══════════════════════════════════════════════════════
# 공급망 네트워크 (supply_chain_edges — 현재 0행)
# ══════════════════════════════════════════════════════
@app.get("/api/supply-chain", response_model=List[SupplyChainEdgeResponse])
def get_supply_chain(
    tier: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(SupplyChainEdge)
    if tier:
        query = query.filter(SupplyChainEdge.tier == tier)
    return query.all()


@app.get("/api/cashmap/network/{company_id}", response_model=NetworkGraphResponse)
def get_network(company_id: int, db: Session = Depends(get_db)):
    """앵커 기업 + 협력사 네트워크. 엣지는 parent_corp(=앵커 corp_name) 기준."""
    company = _resolve_company(db, company_id)

    edges_raw = (
        db.query(SupplyChainEdge)
        .filter(SupplyChainEdge.parent_corp == company.corp_name)
        .all()
    )
    nodes = [NetworkNode(
        id=company.corp_code or str(company.id),
        name=company.corp_name, is_anchor=True, sector=company.sector,
    )]
    seen = {company.corp_code}
    edges = []
    for e in edges_raw:
        child_id = e.child_corp_code or e.child_corp
        if child_id not in seen:
            seen.add(child_id)
            nodes.append(NetworkNode(
                id=child_id, name=e.child_corp, is_anchor=False,
            ))
        edges.append(NetworkEdge(
            source=company.corp_code or str(company.id),
            target=child_id, tier=e.tier, weight=e.edge_weight,
        ))
    return NetworkGraphResponse(nodes=nodes, edges=edges)


# ══════════════════════════════════════════════════════
# 자연어 역방향 검색 — 🔶 임시 (BGE-M3 쿼리 임베딩 대기, AI-A)
# ══════════════════════════════════════════════════════
@app.post("/api/reverse-query", response_model=List[ReverseQueryResult])
def reverse_query(body: ReverseQueryRequest, db: Session = Depends(get_db)):
    """
    임시: 자연어 의미검색(pgvector)은 BGE-M3 쿼리 임베딩이 필요해 AI-A 대기 중.
    현재는 회사명 부분일치 + 최신 신호 강도 순으로 반환.
    """
    cmap = _company_map(db)
    summary = get_signal_summary(db)          # 회사별 최신 신호
    q = (body.query or "").strip()
    ranked = sorted(summary, key=lambda s: s.latest_score, reverse=True)
    if q:
        ranked = [s for s in ranked if q in s.company_name] or ranked
    return [
        ReverseQueryResult(
            rank=i + 1, corp_code=s.corp_code, company_name=s.company_name,
            score=s.latest_score,
            score_reason=f"최신 신호 강도 {s.latest_score:.2f} ({s.trend})",
        )
        for i, s in enumerate(ranked[:5])
    ]


# ══════════════════════════════════════════════════════
# D-Score (ADE) — AI-B 산출 결과 저장/제공 슬롯.
#   조회: GET (목록/단건).  적재: POST(단건)/POST batch — ROLE_ADMIN, company_id upsert.
#   데이터 없으면 목록은 [], 단건은 404 로 graceful (프론트가 처리).
# ══════════════════════════════════════════════════════
_VALID_GRADES = ("POSITIVE", "MONITOR", "NEGATIVE")


def _dscore_to_response(ds: DScore, cmap: dict) -> DScoreResponse:
    co = cmap.get(ds.corp_code) if ds.corp_code else None
    return DScoreResponse(
        id=ds.id, company_id=ds.company_id, corp_code=ds.corp_code,
        corp_name=co.corp_name if co else None,
        d_score=ds.d_score, grade=ds.grade,
        active_patents=ds.active_patents, ipc_entropy=ds.ipc_entropy,
        inventor_count_yoy=ds.inventor_count_yoy,
        rd_ratio=ds.rd_ratio, rd_growth=ds.rd_growth,
        op_margin_slope=ds.op_margin_slope,
        signal_score=ds.signal_score, is_partial=ds.is_partial,
        updated_at=ds.updated_at,
    )


def _upsert_dscore(db: Session, body: DScoreCreate) -> DScore:
    """company_id(UNIQUE) 기준 upsert. 백테스팅 후 재투입되면 값만 갱신됨."""
    if body.grade not in _VALID_GRADES:
        raise HTTPException(
            status_code=422,
            detail=f"grade는 {_VALID_GRADES} 중 하나여야 합니다. (받은 값: {body.grade})",
        )
    row = db.query(DScore).filter(DScore.company_id == body.company_id).first()
    fields = body.model_dump()
    if row:
        for k, v in fields.items():
            setattr(row, k, v)
    else:
        row = DScore(**fields)
        db.add(row)
    return row


@app.get("/api/ade/dscore", response_model=List[DScoreResponse])
def get_dscores(
    grade: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """D-Score 목록 (d_score 내림차순). 데이터 없으면 빈 목록."""
    q = db.query(DScore)
    if grade:
        q = q.filter(DScore.grade == grade)
    rows = q.order_by(DScore.d_score.desc()).limit(limit).all()
    cmap = _company_map(db)
    return [_dscore_to_response(r, cmap) for r in rows]


@app.get("/api/ade/dscore/{company_id}", response_model=DScoreResponse)
def get_dscore(company_id: int, db: Session = Depends(get_db)):
    ds = db.query(DScore).filter(DScore.company_id == company_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="D-Score 데이터가 없습니다. (AI-B 산출 결과 대기)")
    return _dscore_to_response(ds, _company_map(db))


@app.post("/api/ade/dscore", response_model=DScoreResponse)
def ingest_dscore(
    body: DScoreCreate,
    db:   Session = Depends(get_db),
    _:    User    = Depends(require_role(*AI_INGEST_ROLES)),
):
    """AI-B D-Score 단건 적재 (company_id upsert)."""
    row = _upsert_dscore(db, body)
    db.commit()
    db.refresh(row)
    return _dscore_to_response(row, _company_map(db))


@app.post("/api/ade/dscore/batch")
def ingest_dscore_batch(
    body: List[DScoreCreate],
    db:   Session = Depends(get_db),
    _:    User    = Depends(require_role(*AI_INGEST_ROLES)),
):
    """AI-B D-Score 일괄 적재 (company_id upsert). 백테스팅 후 재계산본 재투입에 사용."""
    for item in body:
        _upsert_dscore(db, item)
    db.commit()
    return {"upserted": len(body)}


def _gather_report(db: Session, company_id: int, rm_name: Optional[str] = None) -> ReportData:
    """현재 DB(실데이터: signal_scores/disclosures) + AI-B D-Score(있으면)로 리포트 조립.
    D-Score 미투입 기업은 score/grade None (그래프는 '데이터 수집 중'으로 graceful)."""
    company = _resolve_company(db, company_id)
    ds = db.query(DScore).filter(DScore.company_id == company_id).first()

    sigs = (
        db.query(SignalScore)
        .filter(SignalScore.corp_code == company.corp_code)
        .order_by(SignalScore.rcept_dt.asc(), SignalScore.id.asc())
        .all()
    )
    latest = sigs[-1] if sigs else None
    signal_trend = [(s.rcept_dt.isoformat(), s.s_score) for s in sigs]

    latest_title = None
    if latest:
        chunk = (
            db.query(Disclosure)
            .filter(Disclosure.rcept_no == latest.rcept_no)
            .order_by(Disclosure.chunk_index)
            .first()
        )
        if chunk:
            latest_title = _doc_title(chunk.report_type, chunk.section_title, chunk.rcept_dt)

    data = ReportData(
        company_id=company.id,
        corp_name=company.corp_name,
        corp_code=company.corp_code,
        sector=company.sector,
        is_listed=bool(company.is_listed),
        # D-Score(AI-B)가 투입돼 있으면 실값, 없으면 None → graceful '수집 중'
        score=ds.d_score if ds else None,
        grade=ds.grade if ds else None,
        is_partial=ds.is_partial if ds else True,
        patent_count=ds.active_patents if ds else None,
        ipc_entropy=ds.ipc_entropy if ds else None,
        inventor_growth=ds.inventor_count_yoy if ds else None,
        rd_ratio=ds.rd_ratio if ds else None,
        rd_growth=ds.rd_growth if ds else None,
        op_margin_slope=ds.op_margin_slope if ds else None,
        signal_score=(latest.s_score if latest else (ds.signal_score if ds else None)),
        recommendation="",
        rm_name=rm_name,
        signal_trend=signal_trend,
        category_scores=latest.category_scores if latest else None,
        latest_disclosure_title=latest_title,
    )
    data.recommendation = build_recommendation(data)
    return data


def _attach_narrative(db: Session, d: ReportData, regenerate: bool = False) -> ReportData:
    """AI 서사 제언을 d.narrative 에 채운다. report_narratives 에 캐시:
    입력 신호 해시가 같으면 저장본을 즉시 사용(= '미리 만들어진' 리포트),
    바뀌었거나 없으면 생성→upsert. LLM 미설치 시 build_narrative 가 fallback 으로 graceful."""
    h = narrative_input_hash(d)
    row = (
        db.query(ReportNarrative)
        .filter(ReportNarrative.company_id == d.company_id)
        .first()
    )
    if row and not regenerate and row.input_hash == h and row.sections:
        d.narrative = row.sections
        d.narrative_model = row.model
        if row.generated_at:
            d.generated_at = row.generated_at
        return d

    sections, model = build_narrative(d)
    d.narrative = sections
    d.narrative_model = model
    try:
        if row:
            row.sections, row.model, row.input_hash = sections, model, h
            row.corp_code = d.corp_code
            row.generated_at = datetime.now()
        else:
            db.add(ReportNarrative(
                company_id=d.company_id, corp_code=d.corp_code,
                sections=sections, model=model, input_hash=h,
                generated_at=datetime.now(),
            ))
        db.commit()
    except Exception:
        db.rollback()   # 저장 실패해도 화면엔 생성된 서사를 그대로 제공
    return d


@app.get("/api/report/{company_id}")
def get_report(
    company_id: int,
    regenerate: bool = Query(False, description="캐시 무시하고 서사 재생성"),
    db: Session = Depends(get_db),
    user: User  = Depends(require_role(*READ_ROLES)),
):
    """RM 리포트 통합 JSON. D-Score 미산출이어도 신호 데이터 기반으로 graceful 반환.
    AI 서사 제언(narrative)을 포함 — 미리 생성/캐시되어 즉시 제공."""
    d = _gather_report(db, company_id, rm_name=user.name)
    _attach_narrative(db, d, regenerate=regenerate)
    return {
        "company_id": d.company_id,
        "corp_name":  d.corp_name,
        "corp_code":  d.corp_code,
        "sector":     d.sector,
        "is_listed":  d.is_listed,
        "score":      d.score,
        "grade":      d.grade,
        "is_partial": d.is_partial,
        "patent_count":    d.patent_count,
        "ipc_entropy":     d.ipc_entropy,
        "inventor_growth": d.inventor_growth,
        "rd_ratio":        d.rd_ratio,
        "rd_growth":       d.rd_growth,
        "op_margin_slope": d.op_margin_slope,
        "signal_score":    d.signal_score,
        "recommendation":  d.recommendation,
        "generated_at":    d.generated_at.isoformat(),
        "rm_name":         d.rm_name,
        "signal_trend":    [{"date": dt, "score": sc} for dt, sc in (d.signal_trend or [])],
        "category_scores": d.category_scores,
        "latest_disclosure_title": d.latest_disclosure_title,
        "narrative":       d.narrative,
        "narrative_model": d.narrative_model,
    }


@app.get("/api/report/{company_id}/pdf")
def get_report_pdf(
    company_id: int,
    db: Session = Depends(get_db),
    user: User  = Depends(require_role(*READ_ROLES)),
):
    """RM 리포트 PDF 다운로드 (ReportLab + NanumGothic, 시각화 + AI 서사 포함)."""
    d = _gather_report(db, company_id, rm_name=user.name)
    _attach_narrative(db, d)   # 화면과 동일한 서사를 PDF에도 주입 (화면=PDF 일치)
    pdf = build_pdf(d)
    filename = f"CashMap_리포트_{d.corp_name}_{datetime.now():%Y%m%d}.pdf"
    return Response(
        content=pdf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"},
    )


# ── 리포트 AI 서사 생성 (프론트 구조화 신호 → Ollama/EXAONE) ──
_narrative_gen_cache: dict = {}   # 입력해시 → 응답 (프로세스 메모리 캐시, 데모용)


def _prev_batch_time() -> str:
    """'야간 배치(02:00)' 느낌의 생성 시각 — 직전 02:00."""
    now = datetime.now()
    g = now.replace(hour=2, minute=0, second=0, microsecond=0)
    if now < g:
        g -= timedelta(days=1)
    return f"{g.year}. {g.month:02d}. {g.day:02d} {g.hour:02d}:00"


@app.post("/api/report/narrative")
def generate_narrative(body: NarrativeGenRequest):
    """표시 중인 기업의 구조화 신호로 RM 제언 서사를 생성(Ollama/EXAONE, 룰베이스 fallback).
    company_id 불필요 — 데모 목업 기업 포함. 입력 해시로 캐시(멘토 피드백 '열면 이미 있다').
    반환(프론트 계약): {headline, diagnosis, action, basis, risk, model, generatedAt, source}."""
    key = hashlib.sha256(
        json.dumps(body.model_dump(exclude={"regenerate"}),
                   ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()
    if not body.regenerate and key in _narrative_gen_cache:
        return _narrative_gen_cache[key]

    def _n(v):   # 0~100(목업) → 0~1 정규화
        if v is None:
            return None
        return v / 100.0 if v > 1 else v

    facts = list(body.facts or [])
    if body.anchor and body.theme:
        facts.insert(0, f"발신 대기업: {body.anchor} — 테마 '{body.theme}'")
    if body.tier:
        facts.append(f"공급망 위치: {body.tier}차 협력사")
    if body.discrepancy is not None:
        # 부호 의미를 명시 — 작은 모델이 +를 '불일치=신뢰문제'로 오독하지 않도록
        _disc_ko = ("양수(+)는 특허·R&D 등 실제 행동이 공시 언급을 앞서는 '우량 신호'"
                    if body.discrepancy >= 0 else
                    "음수(-)는 공시가 실제 행동을 앞서는 '거품 경보' 신호")
        facts.append(f"공시-행동 괴리 {body.discrepancy:+g}p ({_disc_ko})")

    d = ReportData(
        company_id=0, corp_name=body.corp_name, corp_code=None,
        sector=body.sector, is_listed=body.is_listed,
        score=_n(body.d_score), grade=body.grade,
        is_partial=(body.d_score is None),
        patent_count=None, ipc_entropy=None, inventor_growth=None,
        rd_ratio=None, rd_growth=None, op_margin_slope=None,
        signal_score=_n(body.signal), recommendation="",
        extra_facts=facts,
    )
    sections, model = build_narrative(d)
    out = {
        "corpName":    body.corp_name,
        "generatedAt": _prev_batch_time(),
        "model":       model,
        "headline":    sections.get("headline"),
        "diagnosis":   sections.get("diagnosis"),
        "action":      sections.get("action"),
        "basis":       sections.get("rationale"),   # 프론트는 basis 키 사용
        "risk":        sections.get("risk"),
        "source":      (f"AI 생성 · {model}" if model != "fallback" else "ADE 자동 분석(룰베이스)"),
    }
    _narrative_gen_cache[key] = out
    return out


_disc_summary_cache: dict = {}


@app.post("/api/disclosures/summary")
def summarize_disclosure_demo(body: DisclosureSummaryRequest):
    """데모 공시(원문 rcept_no 없음)를 EXAONE 로 RM 관점 요약(룰베이스 fallback).
    화면이 가진 제목·발췌·유형·키워드 + 기업 맥락을 받아 요약 문단을 돌려준다. 입력 해시로 캐시."""
    key = hashlib.sha256(
        json.dumps(body.model_dump(exclude={"regenerate"}),
                   ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()
    if not body.regenerate and key in _disc_summary_cache:
        return _disc_summary_cache[key]
    text, model = build_disclosure_summary(body.model_dump())
    out = {
        "summary": text,
        "model":   model,
        "source":  (f"AI 요약 · {model}" if model != "fallback" else "ADE 자동 요약(룰베이스)"),
    }
    _disc_summary_cache[key] = out
    return out


_reverse_interp_cache: dict = {}


@app.post("/api/reverse/interpret")
def interpret_reverse_query(body: ReverseInterpretRequest):
    """역방향 조회: 사용자 자유 질의 → EXAONE 로 키워드 추출 + 후보 산업 시나리오 분류.
    프론트가 후보(key/label/hint)를 함께 보내면 매칭 결과를 돌려준다. 실패 시 sector_key=None(프론트 룰베이스 폴백)."""
    sectors = [s.model_dump() for s in body.sectors]
    key = hashlib.sha256(
        json.dumps({"q": body.query, "s": [s.get("key") for s in sectors]},
                   ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()
    if key in _reverse_interp_cache:
        return _reverse_interp_cache[key]
    out = build_reverse_interpretation(body.query, sectors)
    _reverse_interp_cache[key] = out
    return out


# ══════════════════════════════════════════════════════
# JWT 인증 (AUTH-001) — 그대로 유지
# ══════════════════════════════════════════════════════
@app.post("/api/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.emp_id == body.emp_id).first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사번 또는 비밀번호가 올바르지 않습니다.",
        )
    return TokenResponse(
        access_token=create_access_token(user.emp_id, user.role),
        refresh_token=create_refresh_token(user.emp_id),
        role=user.role, name=user.name,
    )


@app.post("/api/auth/refresh", response_model=AccessTokenResponse)
def refresh_token(body: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh Token이 아닙니다.")
    user = db.query(User).filter(User.emp_id == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없습니다.")
    return AccessTokenResponse(access_token=create_access_token(user.emp_id, user.role))


@app.post("/api/auth/logout")
def logout():
    return {"message": "로그아웃 완료"}


@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.post("/api/auth/register", response_model=UserResponse)
def register(
    body: UserCreate,
    db:   Session = Depends(get_db),
    _:    User    = Depends(require_role("ROLE_ADMIN")),
):
    if db.query(User).filter(User.emp_id == body.emp_id).first():
        raise HTTPException(status_code=409, detail="이미 존재하는 사번입니다.")
    if body.role not in READ_ROLES:
        raise HTTPException(status_code=400, detail="유효하지 않은 역할입니다.")
    user = User(
        emp_id=body.emp_id, password=hash_password(body.password),
        role=body.role, name=body.name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
