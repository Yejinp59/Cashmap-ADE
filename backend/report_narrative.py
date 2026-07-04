"""
RM 리포트 AI 서사(제언) 생성기

멘토 피드백 반영: 정량 수치 나열을 넘어, "이 기업이 지금 어떤 국면이고 RM이 무엇을
해야 하는가"를 줄글 제언으로 제공한다. 화면·PDF가 같은 sections 를 쓰도록 스키마 고정.

출력 스키마 (모두 한국어 plain text):
    {
      "headline":  "한 줄 결론",
      "diagnosis": "현재 국면 진단 (2~3문장)",
      "action":    "RM 추천 액션 (무엇을·언제·어떻게)",
      "rationale": "근거 (정량 신호 인용)",
      "risk":      "리스크·주의·모니터링 포인트",
    }

생성 경로:
    build_narrative(d)  →  LLM(Ollama/EXAONE) 시도 → 실패/미설치 시 룰베이스 fallback.
    LLM 없이도 항상 채워진 리포트가 나오는 게 설계 원칙.
"""

import os
import re
import json
import hashlib
from typing import Optional, Tuple

import requests

from report_builder import ReportData

OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "exaone3.5:2.4b")

SECTION_KEYS = ("headline", "diagnosis", "action", "rationale", "risk")

# signal_scores.category_scores 키 → 한글 라벨 (report_builder.CATEGORY_META 와 정렬)
_CATEGORY_LABEL = {
    "capex_positive":    "설비투자",
    "order_positive":    "신규 수주",
    "material_positive":  "소재·공급",
    "negative_signal":   "부정 신호",
}

_GRADE_LABEL = {
    "POSITIVE": "숨은 진주",
    "NEGATIVE": "거품 경보",
    "MONITOR":  "모니터링",
}


# ── 신호 요약 헬퍼 ────────────────────────────────────
def _trend_dir(trend) -> Optional[str]:
    """signal_trend [(date, score), ...] → 'up' / 'down' / 'flat' / None."""
    if not trend or len(trend) < 2:
        return None
    vals = [s for _, s in trend if isinstance(s, (int, float))]
    if len(vals) < 2:
        return None
    delta = vals[-1] - vals[0]
    if delta > 0.05:
        return "up"
    if delta < -0.05:
        return "down"
    return "flat"


def _top_category(category_scores) -> Optional[Tuple[str, float]]:
    """카테고리 분해에서 가장 가중치 큰 항목 → (한글라벨, weighted_score)."""
    if not category_scores:
        return None
    best, best_v = None, -1.0
    for key, v in category_scores.items():
        ws = abs((v or {}).get("weighted_score") or 0) if isinstance(v, dict) else abs(v or 0)
        if ws > best_v:
            best, best_v = key, ws
    if best is None:
        return None
    return _CATEGORY_LABEL.get(best, best), best_v


def _signal_facts(d: ReportData) -> dict:
    """LLM 프롬프트/룰베이스가 공통으로 쓰는 정량 사실 묶음."""
    trend_dir = _trend_dir(d.signal_trend)
    top_cat   = _top_category(d.category_scores)
    n_points  = len(d.signal_trend or [])
    n_high    = len(d.highlights or [])
    return {
        "grade_label": _GRADE_LABEL.get(d.grade) if d.grade else None,
        "score":       d.score,
        "signal":      d.signal_score,
        "trend_dir":   trend_dir,
        "n_points":    n_points,
        "top_cat":     top_cat[0] if top_cat else None,
        "n_highlight": n_high,
        "disclosure":  d.latest_disclosure_title,
    }


def narrative_input_hash(d: ReportData) -> str:
    """입력 신호가 바뀌었는지 판단하는 해시 (재생성 트리거)."""
    payload = {
        "score": d.score, "grade": d.grade, "signal": d.signal_score,
        "trend": d.signal_trend, "cat": d.category_scores,
        "title": d.latest_disclosure_title,
        "nh": len(d.highlights or []),
        "model": OLLAMA_MODEL,
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ── 룰베이스 fallback (LLM 없이도 항상 채워짐) ───────────
def build_narrative_fallback(d: ReportData) -> dict:
    f = _signal_facts(d)
    corp = d.corp_name
    sector = d.sector or "해당 섹터"
    trend_ko = {"up": "상승", "down": "하락", "flat": "횡보"}.get(f["trend_dir"])
    sig_txt = f"{f['signal']:.2f}" if isinstance(f["signal"], (int, float)) else None

    # ── headline ──
    if d.grade == "POSITIVE":
        headline = f"{corp} — 행동이 공시를 앞서는 우량 신호, 타행 선점 전 선제 접촉 적기."
    elif d.grade == "NEGATIVE":
        headline = f"{corp} — 공시 대비 행동 지표 부족, 여신 한도 재점검 권고."
    elif f["trend_dir"] == "up":
        headline = f"{corp} — 공시 신호 강도 상승 추세, 관찰 우선순위 상향 권장."
    elif f["trend_dir"] == "down":
        headline = f"{corp} — 신호 강도 둔화, 후속 공시 확인 후 판단."
    else:
        headline = f"{corp} — {sector} 흐름 속 추세 관찰이 필요한 중립 구간."

    # ── diagnosis ──
    diag = []
    if f["grade_label"]:
        diag.append(f"{corp}는 현재 ADE 등급상 '{f['grade_label']}' 구간입니다.")
    else:
        diag.append(f"{corp}는 D-Score(특허·재무) 산출 전 단계로, CashMap 공시 신호 위주로 진단합니다.")
    if sig_txt and trend_ko:
        diag.append(f"최신 공시 신호 강도는 {sig_txt}이며, 최근 {f['n_points']}개 시점에서 {trend_ko} 흐름을 보입니다.")
    elif sig_txt:
        diag.append(f"최신 공시 신호 강도는 {sig_txt}로 관측됩니다.")
    if f["top_cat"]:
        diag.append(f"신호를 주도하는 영역은 '{f['top_cat']}'로, 해당 방향의 행동이 가장 두드러집니다.")

    # ── action ──
    if d.grade == "POSITIVE" or f["trend_dir"] == "up":
        action = ("RM 접촉 우선순위를 상향하고, 선제 여신·운전자금 제안을 준비하세요. "
                  "신호가 더 확산되기 전 첫 컨택을 잡는 것이 타행 선점에 유리합니다.")
    elif d.grade == "NEGATIVE":
        action = ("신규 한도 확대는 보류하고 여신감리팀과 공유하세요. "
                  "후속 공시·실적으로 행동지표 개선 여부를 확인한 뒤 재평가를 권합니다.")
    else:
        action = ("지금은 적극 제안보다 관찰 단계입니다. 다음 분기 공시·실적을 확인하고, "
                  "신호가 상승 전환하면 접촉 우선순위를 올리세요.")

    # ── rationale ──
    rat = []
    if sig_txt:
        rat.append(f"최신 공시 신호 강도 S={sig_txt}")
    if trend_ko:
        rat.append(f"최근 {f['n_points']}개 시점 {trend_ko} 추세")
    if f["top_cat"]:
        rat.append(f"주도 카테고리 '{f['top_cat']}'")
    if isinstance(d.score, (int, float)):
        rat.append(f"D-Score {d.score:.2f}")
    if f["n_highlight"]:
        rat.append(f"공시 핵심 신호 문장 {f['n_highlight']}건")
    rationale = (
        "근거: " + ", ".join(rat) + "."
        + (f" 출처 공시: {f['disclosure']}." if f["disclosure"] else "")
    ) if rat else "현재 확보된 신호가 제한적이라, 데이터 보강 후 근거가 구체화됩니다."

    # ── risk ──
    risk_parts = []
    if d.is_partial or d.score is None:
        risk_parts.append("D-Score(특허·재무) 미산출 상태로, 행동지표 확보 시 등급이 바뀔 수 있습니다.")
    if d.grade == "NEGATIVE":
        risk_parts.append("공시 의지가 실제 행동을 앞서는 '텍스트 과잉' 가능성에 유의하세요.")
    if f["trend_dir"] == "down":
        risk_parts.append("신호 강도 둔화가 이어지는지 후속 공시를 모니터링하세요.")
    if not risk_parts:
        risk_parts.append("단일 분기 신호에 과의존하지 말고, 다음 공시로 추세를 재확인하세요.")
    risk = " ".join(risk_parts)

    return {
        "headline":  headline,
        "diagnosis": " ".join(diag),
        "action":    action,
        "rationale": rationale,
        "risk":      risk,
    }


# ── LLM 생성 (Ollama / EXAONE) ────────────────────────
def _build_prompt(d: ReportData) -> str:
    f = _signal_facts(d)
    lines = [f"- 기업명: {d.corp_name}"]
    if d.sector:
        lines.append(f"- 섹터: {d.sector}")
    lines.append(f"- 상장 여부: {'상장사' if d.is_listed else '비상장'}")
    if f["grade_label"]:
        lines.append(f"- ADE 등급: {f['grade_label']}")
    else:
        lines.append("- ADE D-Score: 미산출(특허·재무 데이터 수집 전)")
    if isinstance(f["signal"], (int, float)):
        lines.append(f"- 최신 공시 신호 강도(S): {f['signal']:.2f}")
    if f["trend_dir"]:
        ko = {"up": "상승", "down": "하락", "flat": "횡보"}[f["trend_dir"]]
        lines.append(f"- 신호 추세: 최근 {f['n_points']}개 시점 {ko}")
    if f["top_cat"]:
        lines.append(f"- 주도 신호 카테고리: {f['top_cat']}")
    if f["disclosure"]:
        lines.append(f"- 최근 공시: {f['disclosure']}")
    if d.highlights:
        top = sorted(d.highlights, key=lambda h: h.get("score", 0), reverse=True)[:3]
        for h in top:
            s = (h.get("sentence") or "").strip()
            if s:
                lines.append(f"- 공시 신호 문장: {s[:140]}")
    # 프론트가 전달한 정량 사실(특허/R&D/괴리 등) — 데모 목업 기업의 행동지표 인용용
    for fct in (getattr(d, "extra_facts", None) or []):
        fct = str(fct).strip()
        if fct:
            lines.append(f"- {fct}")

    facts = "\n".join(lines)
    return (
        "당신은 하나은행 기업금융팀 RM을 돕는 여신 애널리스트입니다. "
        "아래 기업의 신호 데이터를 바탕으로, RM이 영업 현장에서 바로 활용할 수 있는 "
        "충실하고 구체적인 분석 제언을 작성하세요.\n"
        "매우 중요한 출력 규칙: 각 항목은 반드시 '하나의 자연스러운 줄글 문단'입니다. "
        "번호 목록(1. 2. 3.)·불릿(-, ·)·굵은 글씨(**)·머리말·마크다운을 절대 쓰지 말고, "
        "여러 항목을 나열하지 말고 문장으로 이어서 서술하세요. 아래 JSON 형식만 출력하세요.\n"
        "형식과 각 항목의 분량·요건:\n"
        '{\n'
        '  "headline": "한 문장. 기업명, 판단(숨은 진주/거품/중립), RM 함의를 담은 핵심 결론",\n'
        '  "diagnosis": "4~6문장의 한 문단. 특허 수·R&D 비중·R&D 성장률·발명자 증감률·IPC Entropy·영업이익률 기울기 중 최소 3개 수치를 직접 인용하고, 왜 이 등급인지(공시-행동 괴리 관점 포함)를 인과적으로 설명",\n'
        '  "action": "3~4문장의 한 문단. RM이 취할 핵심 행동을 무엇을·언제·어떻게 관점으로 서술하되, 적합한 여신 상품(운전자금/시설자금 등)과 컨택 타이밍, 타행 선점 관점을 문장 속에 자연스럽게 녹일 것. 절대 번호 목록으로 나열하지 말 것",\n'
        '  "rationale": "2~3문장의 한 문단. 위 진단과 액션을 뒷받침하는 정량 근거를 수치와 함께 제시",\n'
        '  "risk": "2~3문장의 한 문단. 핵심 리스크와 RM이 관찰해야 할 모니터링 포인트를 구체적으로 명시"\n'
        '}\n'
        "각 값은 과장 없이 사실에 근거하고, 위 데이터에 없는 수치는 절대 지어내지 마세요. "
        "제공된 수치는 최대한 본문에 녹여 인용하세요.\n\n"
        f"=== 기업 신호 데이터 ===\n{facts}\n\n=== JSON 출력 ===\n"
    )


def _parse_llm_json(text: str) -> Optional[dict]:
    """LLM 응답에서 JSON 객체를 추출·파싱. 실패 시 None."""
    if not text:
        return None
    t = text.strip()
    t = re.sub(r"^```(?:json)?", "", t).strip()
    t = re.sub(r"```$", "", t).strip()
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        obj = json.loads(t[start:end + 1])
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(obj, dict):
        return None
    out = {}
    for k in SECTION_KEYS:
        v = obj.get(k)
        if not isinstance(v, str) or not v.strip():
            return None   # 한 섹션이라도 비면 fallback 으로
        out[k] = _clean_section(v)
    return out


def _clean_section(v: str) -> str:
    """작은 모델이 흘리는 마크다운·번호 목록 잔재를 걷어낸다."""
    v = v.replace("**", "").replace("\r", "")
    # 문단 중간의 "1. " "2) " 같은 번호 매김 → 자연스러운 문장 구분으로
    v = re.sub(r"\s*\n+\s*", " ", v)
    v = re.sub(r"(?<=[.!?])\s*\d{1,2}[.)]\s+", " ", v)   # 문장 뒤 번호 목록 제거
    v = re.sub(r"^\s*\d{1,2}[.)]\s+", "", v)             # 맨 앞 번호 제거
    v = re.sub(r"\s{2,}", " ", v)
    return v.strip()


def build_narrative_llm(d: ReportData, timeout: int = 120) -> Optional[dict]:
    """Ollama 로컬 LLM 으로 서사 생성. 연결 실패/미설치/파싱 실패 시 None."""
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL, "prompt": _build_prompt(d), "stream": False,
                "format": "json",
                "options": {"temperature": 0.35, "num_predict": 1100},
            },
            timeout=timeout,
        )
    except requests.exceptions.RequestException:
        return None
    if not resp.ok:
        return None
    try:
        text = (resp.json().get("response") or "")
    except ValueError:
        return None
    return _parse_llm_json(text)


# ── 공시 단건 AI 요약 (데모 공시: 원문 없이 제목·발췌·유형으로 요약) ──
_SIGNAL_KO = {
    "action":  "행동 신호(특허·증설·계약 등 실제 실행을 동반)",
    "plan":    "계획·기대 신호(집행 전 계획·검토 단계)",
    "routine": "정기·안내성 공시",
}


def _disclosure_prompt(f: dict) -> str:
    lines = []
    if f.get("corp_name"): lines.append(f"- 기업: {f['corp_name']}")
    if f.get("sector"):    lines.append(f"- 업종: {f['sector']}")
    if f.get("grade"):     lines.append(f"- ADE 등급: {_GRADE_LABEL.get(f['grade'], f['grade'])}")
    if f.get("theme"):     lines.append(f"- 연관 대기업 테마: {f['theme']}")
    lines.append(f"- 공시 제목: {f.get('title')}")
    if f.get("doc_type"):  lines.append(f"- 공시 유형: {f['doc_type']}")
    if f.get("signal"):    lines.append(f"- ADE 신호 분류: {_SIGNAL_KO.get(f['signal'], f['signal'])}")
    if f.get("excerpt"):   lines.append(f"- 공시 발췌: {f['excerpt']}")
    if f.get("keywords"):  lines.append(f"- 키워드: {', '.join(f['keywords'])}")
    facts = "\n".join(lines)
    return (
        "당신은 하나은행 기업금융팀 RM을 돕는 여신 애널리스트입니다. "
        "아래 전자공시를 RM 관점에서 요약하세요.\n"
        "반드시 한국어 plain text로, 2~3문장의 자연스러운 한 문단(번호·불릿·마크다운·머리말 금지)으로 작성하세요.\n"
        "① 이 공시가 무엇을 알리는지 ② ADE가 왜 이 신호로 분류했는지 ③ RM이 주목할 점을 한 문단에 녹이세요. "
        "제공된 정보에 없는 사실은 지어내지 마세요.\n\n"
        f"=== 공시 정보 ===\n{facts}\n\n=== 요약 ===\n"
    )


def _disclosure_summary_fallback(f: dict) -> str:
    corp = f.get("corp_name") or "해당 기업"
    sig = _SIGNAL_KO.get(f.get("signal"), "공시")
    base = (f.get("excerpt") or "").strip()
    tail = {
        "action":  " 실제 실행을 동반한 행동 신호로, 선제 접촉·여신 제안 검토에 참고할 수 있습니다.",
        "plan":    " 집행 전 계획·기대 성격이라, 후속 실행 공시로 실현 여부를 확인할 필요가 있습니다.",
        "routine": " 정기·안내성 공시로, 추세 확인용 참고 자료입니다.",
    }.get(f.get("signal"), "")
    body = f" {base}" if base else ""
    return f"{corp}의 '{f.get('title')}' 공시입니다.{body} ADE는 이를 {sig}로 분류했습니다.{tail}"


def build_disclosure_summary(f: dict) -> Tuple[str, str]:
    """(요약 텍스트, model) 반환. Ollama/EXAONE 우선, 실패 시 룰베이스 fallback."""
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": _disclosure_prompt(f), "stream": False,
                  "options": {"temperature": 0.3, "num_predict": 360}},
            timeout=90,
        )
        if resp.ok:
            text = _clean_section((resp.json().get("response") or "").strip())
            if len(text) >= 12:
                return text, OLLAMA_MODEL
    except requests.exceptions.RequestException:
        pass
    return _disclosure_summary_fallback(f), "fallback"


# ── 역방향 조회: 자유 질의 → 키워드 추출 + 산업 시나리오 분류 ──
def _reverse_prompt(query: str, sectors: list) -> str:
    lines = []
    for s in sectors:
        hint = f" | 힌트: {s.get('hint')}" if s.get("hint") else ""
        lines.append(f"- key={s.get('key')} | {s.get('label')}{hint}")
    cands = "\n".join(lines)
    return (
        "당신은 하나은행 기업금융팀 RM을 돕는 산업 애널리스트입니다. "
        "아래 사용자 질의를 분석해 두 가지를 수행하세요.\n"
        "1) 질의의 핵심 키워드 3~6개를 뽑는다(짧은 명사구).\n"
        "2) 아래 후보 산업 시나리오 중 질의와 가장 관련된 하나의 key를 고른다(반드시 후보 key 중 하나).\n"
        "반드시 아래 JSON 형식만 출력하세요(마크다운·설명 금지).\n"
        '{"keywords": ["키워드1", "키워드2", ...], "sector_key": "후보의 key", "rationale": "그 시나리오를 고른 이유 한 문장"}\n'
        "질의에 없는 내용을 지어내지 마세요. "
        "rationale에는 'cg-...' 같은 내부 key 문자열을 쓰지 말고 산업/기업 이름으로 자연스럽게 설명하세요.\n\n"
        f"=== 사용자 질의 ===\n{query}\n\n=== 후보 산업 시나리오 ===\n{cands}\n\n=== JSON 출력 ===\n"
    )


def _parse_reverse_json(text: str, valid_keys: set) -> Optional[dict]:
    if not text:
        return None
    t = re.sub(r"^```(?:json)?", "", text.strip()).strip()
    t = re.sub(r"```$", "", t).strip()
    a, b = t.find("{"), t.rfind("}")
    if a == -1 or b <= a:
        return None
    try:
        obj = json.loads(t[a:b + 1])
    except (json.JSONDecodeError, ValueError):
        return None
    if not isinstance(obj, dict):
        return None
    kws = obj.get("keywords")
    kws = [str(k).strip() for k in kws if str(k).strip()][:6] if isinstance(kws, list) else []
    sk = obj.get("sector_key")
    sk = sk if (isinstance(sk, str) and sk in valid_keys) else None
    rat = obj.get("rationale")
    if isinstance(rat, str) and rat.strip():
        # 내부 key(cg-...) 노출 방어 — 따옴표 감싼 것/맨 것 모두 제거
        rat = re.sub(r"['\"]?cg-[a-z]+['\"]?\s*(관련(인)?|시나리오|이|가|는|을|를)?", "", rat)
        rat = re.sub(r"\s{2,}", " ", rat).strip(" ,·")
        rat = rat or None
    else:
        rat = None
    if not kws and sk is None:
        return None
    return {"keywords": kws, "sector_key": sk, "rationale": rat}


def build_reverse_interpretation(query: str, sectors: list) -> dict:
    """(keywords, sector_key, rationale, model) — EXAONE 우선, 실패 시 sector_key=None(프론트가 룰베이스 폴백)."""
    valid_keys = {s.get("key") for s in sectors}
    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": OLLAMA_MODEL, "prompt": _reverse_prompt(query, sectors), "stream": False,
                  "format": "json", "options": {"temperature": 0.2, "num_predict": 300}},
            timeout=90,
        )
        if resp.ok:
            obj = _parse_reverse_json(resp.json().get("response") or "", valid_keys)
            if obj:
                return {**obj, "model": OLLAMA_MODEL}
    except requests.exceptions.RequestException:
        pass
    return {"keywords": [], "sector_key": None, "rationale": None, "model": "fallback"}


def build_narrative(d: ReportData, use_llm: bool = True) -> Tuple[dict, str]:
    """(sections, model) 반환. LLM 우선, 실패 시 룰베이스 fallback.
    model 은 생성 출처('exaone3.5:2.4b' 또는 'fallback')."""
    if use_llm:
        sections = build_narrative_llm(d)
        if sections:
            return sections, OLLAMA_MODEL
    return build_narrative_fallback(d), "fallback"
