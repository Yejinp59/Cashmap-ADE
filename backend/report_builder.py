"""
RM 액션 리포트 PDF 빌더
- ReportLab + NanumGothic (SIL OFL)
- 입력: ReportData (D-Score + 회사 + 추천 사유 등)
- 출력: BytesIO PDF
"""

import io
import os
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether,
)
from reportlab.graphics.shapes import Drawing, String, Rect
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.charts.doughnut import Doughnut
from reportlab.graphics.widgets.markers import makeMarker

# ── 폰트 등록 (모듈 로드 시 1회) ────────────────────
_ASSETS = os.path.join(os.path.dirname(__file__), "assets")
_REGISTERED = False

def _register_fonts():
    global _REGISTERED
    if _REGISTERED:
        return
    pdfmetrics.registerFont(TTFont("Nanum",     os.path.join(_ASSETS, "NanumGothic.ttf")))
    pdfmetrics.registerFont(TTFont("NanumBold", os.path.join(_ASSETS, "NanumGothic-Bold.ttf")))
    _REGISTERED = True


# ── 색상 (V0 톤 매칭) ──────────────────────────────
COLOR_PRIMARY    = colors.HexColor("#1e40af")   # 진청
COLOR_SUCCESS    = colors.HexColor("#16a34a")
COLOR_DANGER     = colors.HexColor("#dc2626")
COLOR_MONITOR    = colors.HexColor("#d97706")
COLOR_TEXT       = colors.HexColor("#0f172a")
COLOR_MUTED      = colors.HexColor("#64748b")
COLOR_LIGHT      = colors.HexColor("#f1f5f9")
COLOR_BORDER     = colors.HexColor("#e2e8f0")

GRADE_INFO = {
    "POSITIVE": ("숨은 진주", COLOR_SUCCESS),
    "NEGATIVE": ("거품 경보", COLOR_DANGER),
    "MONITOR":  ("모니터링",  COLOR_MONITOR),
}

# signal_scores.category_scores 키 → (한글 라벨, 색) — 프론트 signal-category-breakdown 과 정렬
CATEGORY_META = {
    "capex_positive":    ("설비투자", colors.HexColor("#2563eb")),
    "order_positive":    ("신규 수주", COLOR_SUCCESS),
    "material_positive": ("소재·공급", COLOR_MONITOR),
    "negative_signal":   ("부정 신호", COLOR_DANGER),
}


@dataclass
class ReportData:
    company_id:      int
    corp_name:       str
    sector:          Optional[str]
    is_listed:       bool
    score:           float
    grade:           str
    is_partial:      bool
    patent_count:    Optional[int]
    ipc_entropy:     Optional[float]
    inventor_growth: Optional[float]
    rd_ratio:        Optional[float]
    rd_growth:       Optional[float]
    op_margin_slope: Optional[float]
    signal_score:    Optional[float]
    recommendation:  str          # 추천 사유 문장
    generated_at:    datetime = field(default_factory=datetime.now)
    # 최근 공시에서 추출한 핵심 신호 문장 [{sentence, score, category}] (AI-A 산출)
    highlights:      Optional[list] = None
    highlight_source: Optional[str] = None   # 발췌 출처 공시 제목
    # ── 시각화/헤더 보강 ──
    corp_code:       Optional[str] = None
    rm_name:         Optional[str] = None     # 담당 RM (헤더 표기)
    # 신호 강도 시계열 [(date_str, score), ...] 시간순 (라인차트)
    signal_trend:    Optional[list] = None
    # 최신 신호의 카테고리 분해 {key: {weighted_score, weight, ...}} (도넛)
    category_scores: Optional[dict] = None
    latest_disclosure_title: Optional[str] = None
    # AI 서사 제언 {headline, diagnosis, action, rationale, risk} (report_narrative 산출)
    narrative:       Optional[dict] = None
    narrative_model: Optional[str]  = None    # 'exaone3.5:2.4b' | 'fallback'
    # 서사 프롬프트에 추가로 실을 정량 사실 문자열 (예: '특허 수 412건', '공시-행동 괴리 +18p')
    extra_facts:     Optional[list] = None


# ── 스타일 헬퍼 ────────────────────────────────────
def _styles():
    return {
        "title":   ParagraphStyle("title",   fontName="NanumBold", fontSize=18, leading=22, textColor=COLOR_TEXT),
        "subtitle":ParagraphStyle("subtitle",fontName="Nanum",     fontSize=10, leading=14, textColor=COLOR_MUTED),
        "h2":      ParagraphStyle("h2",      fontName="NanumBold", fontSize=13, leading=18, textColor=COLOR_TEXT, spaceBefore=8, spaceAfter=4),
        "body":    ParagraphStyle("body",    fontName="Nanum",     fontSize=10, leading=15, textColor=COLOR_TEXT),
        "small":   ParagraphStyle("small",   fontName="Nanum",     fontSize=9,  leading=12, textColor=COLOR_MUTED),
        "recBox":  ParagraphStyle("recBox",  fontName="Nanum",     fontSize=10, leading=16, textColor=COLOR_SUCCESS, leftIndent=8, rightIndent=8),
        "headline":ParagraphStyle("headline",fontName="NanumBold", fontSize=12, leading=17, textColor=COLOR_PRIMARY, leftIndent=8, rightIndent=8),
        "narLabel":ParagraphStyle("narLabel",fontName="NanumBold", fontSize=10, leading=14, textColor=COLOR_MUTED, spaceBefore=6),
        "narBody": ParagraphStyle("narBody", fontName="Nanum",     fontSize=10, leading=15, textColor=COLOR_TEXT, spaceAfter=2),
    }


# ── 차트 헬퍼 (reportlab.graphics, 외부 의존성 없음) ──
_CHART_W = 470   # 본문 폭(약 174mm)에 맞춘 드로잉 폭(pt)


def _s_vs_d_chart(s_score, d_score, grade_color) -> Drawing:
    """공시 의지(S) vs 행동(D-Score) 가로 막대. None은 '데이터 수집 중'."""
    d = Drawing(_CHART_W, 110)
    axis_x, max_w = 110, 290
    scale = max(1.0, s_score or 0, d_score or 0)
    rows = [
        ("공시 의지 (S)",   s_score, COLOR_PRIMARY),
        ("행동 (D-Score)", d_score, grade_color),
    ]
    y = 70
    for label, val, color in rows:
        d.add(String(8, y + 5, label, fontName="Nanum", fontSize=10, fillColor=COLOR_TEXT))
        d.add(Rect(axis_x, y, max_w, 18, fillColor=COLOR_LIGHT,
                   strokeColor=COLOR_BORDER, strokeWidth=0.5))
        if val is not None:
            bw = max(2, (val / scale) * max_w)
            d.add(Rect(axis_x, y, bw, 18, fillColor=color, strokeColor=None))
            d.add(String(axis_x + bw + 6, y + 5, f"{val:.2f}",
                         fontName="NanumBold", fontSize=10, fillColor=COLOR_TEXT))
        else:
            d.add(String(axis_x + 8, y + 5, "데이터 수집 중",
                         fontName="Nanum", fontSize=9, fillColor=COLOR_MUTED))
        y -= 42
    return d


def _trend_chart(trend) -> Optional[Drawing]:
    """신호 강도 시계열 라인차트. trend=[(date_str, score), ...]."""
    pts = [(str(t), float(s)) for t, s in (trend or []) if s is not None]
    if not pts:
        return None
    names = [p[0][5:] if len(p[0]) >= 10 else p[0] for p in pts]   # 'MM-DD'
    vals  = [p[1] for p in pts]

    d = Drawing(_CHART_W, 170)
    lc = HorizontalLineChart()
    lc.x, lc.y, lc.width, lc.height = 38, 32, 410, 120
    lc.data = [vals]

    step = max(1, len(names) // 8)
    lc.categoryAxis.categoryNames = [nm if i % step == 0 else "" for i, nm in enumerate(names)]
    lc.categoryAxis.labels.fontName = "Nanum"
    lc.categoryAxis.labels.fontSize = 7
    lc.categoryAxis.labels.angle = 30
    lc.categoryAxis.labels.boxAnchor = "ne"

    lc.valueAxis.valueMin = 0
    lc.valueAxis.valueMax = max(1.0, max(vals) * 1.15)
    lc.valueAxis.labels.fontName = "Nanum"
    lc.valueAxis.labels.fontSize = 8

    lc.lines[0].strokeColor = COLOR_PRIMARY
    lc.lines[0].strokeWidth = 2
    lc.lines[0].symbol = makeMarker("FilledCircle", size=4, fillColor=COLOR_PRIMARY)
    d.add(lc)
    return d


def _category_donut(category_scores) -> Optional[Drawing]:
    """신호 카테고리 분해 도넛 + 범례. 가중 기여도 절대값 기준."""
    if not category_scores:
        return None
    items = []
    for key, v in category_scores.items():
        ws = abs((v or {}).get("weighted_score") or 0)
        if ws <= 0:
            continue
        label, color = CATEGORY_META.get(key, (key, COLOR_MUTED))
        items.append((label, ws, color))
    if not items:
        return None

    d = Drawing(_CHART_W, 150)
    dn = Doughnut()
    dn.x, dn.y, dn.width, dn.height = 10, 8, 134, 134
    dn.data = [it[1] for it in items]
    dn.innerRadiusFraction = 0.55
    for i, it in enumerate(items):
        dn.slices[i].fillColor = it[2]
        dn.slices[i].strokeColor = colors.white
        dn.slices[i].strokeWidth = 1
    d.add(dn)

    total = sum(it[1] for it in items) or 1
    ly = 120
    for label, val, color in items:
        d.add(Rect(180, ly, 11, 11, fillColor=color, strokeColor=None))
        d.add(String(198, ly + 1, f"{label}   {val / total * 100:.0f}%",
                     fontName="Nanum", fontSize=10, fillColor=COLOR_TEXT))
        ly -= 24
    return d


# ── AI 서사 제언 렌더 ───────────────────────────────
def _narrative_flowables(d: ReportData, s) -> list:
    """narrative {headline, diagnosis, action, rationale, risk} → PDF 플로우.
    화면 리포트와 동일한 sections 를 사용해 화면=PDF 일치를 보장."""
    n = d.narrative or {}
    by_model = "AI 생성" if (d.narrative_model and d.narrative_model != "fallback") else "자동 작성"
    out = [Paragraph(f"AI 분석 제언 <font size=8 color='#94a3b8'>· {by_model}</font>", s["h2"])]

    # 결론 헤드라인 (청색 콜아웃 박스)
    if n.get("headline"):
        hl = Table([[Paragraph(n["headline"], s["headline"])]], colWidths=[158*mm])
        hl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#eff6ff")),
            ("BOX",           (0, 0), (-1, -1), 0.5, COLOR_PRIMARY),
            ("LEFTPADDING",   (0, 0), (-1, -1), 12),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
            ("TOPPADDING",    (0, 0), (-1, -1), 9),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ]))
        out.append(KeepTogether(hl))
        out.append(Spacer(1, 3*mm))

    for label, key in (("현재 진단", "diagnosis"), ("추천 액션", "action"),
                       ("근거", "rationale"), ("리스크·주의", "risk")):
        val = (n.get(key) or "").strip()
        if not val:
            continue
        out.append(Paragraph(label, s["narLabel"]))
        out.append(Paragraph(val, s["narBody"]))
    return out


# ── PDF 생성 ────────────────────────────────────────
def build_pdf(d: ReportData) -> io.BytesIO:
    _register_fonts()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18*mm, rightMargin=18*mm,
        topMargin=18*mm,  bottomMargin=18*mm,
        title=f"{d.corp_name} RM 액션 리포트",
    )
    s = _styles()
    story = []
    grade_label, grade_color = GRADE_INFO.get(d.grade, (d.grade or "데이터 수집 중", COLOR_MUTED))

    # ── 헤더 ──
    story.append(Paragraph(f"{d.corp_name} — RM 액션 리포트", s["title"]))
    story.append(Paragraph(
        f"생성일 {d.generated_at:%Y.%m.%d %H:%M} · NOVA (CashMap × ADE)"
        + (f" · 담당 RM {d.rm_name}" if d.rm_name else "")
        + (" · 부분 스코어" if d.is_partial else ""),
        s["subtitle"]
    ))
    story.append(Spacer(1, 6*mm))

    # ── 회사 메타 ──
    meta_tbl = Table([
        ["기업명",    d.corp_name],
        ["corp_code", d.corp_code or "-"],
        ["섹터",      d.sector or "-"],
        ["상장",      "상장" if d.is_listed else "비상장"],
        ["등급",      grade_label],
    ], colWidths=[28*mm, 130*mm])
    meta_tbl.setStyle(TableStyle([
        ("FONT",            (0, 0), (-1, -1), "Nanum", 10),
        ("FONT",            (0, 0), (0, -1),  "NanumBold", 10),
        ("TEXTCOLOR",       (0, 0), (0, -1),  COLOR_MUTED),
        ("BACKGROUND",      (0, 0), (0, -1),  COLOR_LIGHT),
        ("TEXTCOLOR",       (1, 4), (1, 4),   grade_color),
        ("FONT",            (1, 4), (1, 4),   "NanumBold", 10),
        ("BOX",             (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("INNERGRID",       (0, 0), (-1, -1), 0.3, COLOR_BORDER),
        ("LEFTPADDING",     (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",    (0, 0), (-1, -1), 6),
        ("TOPPADDING",      (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",   (0, 0), (-1, -1), 5),
    ]))
    story.append(meta_tbl)
    story.append(Spacer(1, 6*mm))

    # ── D-Score 카드 ──
    story.append(Paragraph("D-Score 종합", s["h2"]))
    score_disp = f"{d.score:.2f}" if d.score is not None else "수집 중"
    s_disp     = f"{d.signal_score:.2f}" if d.signal_score is not None else "수집 중"
    dscore_tbl = Table([
        [Paragraph(f'<font name="NanumBold" size="32" color="{grade_color.hexval()}">{score_disp}</font>', s["body"]),
         Paragraph(f"<b>{grade_label}</b><br/>"
                   f"<font color='#64748b'>공시 의지 점수 S = {s_disp}</font>",
                   s["body"])],
    ], colWidths=[50*mm, 108*mm])
    dscore_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), COLOR_LIGHT),
        ("BOX",           (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",         (0, 0), (0, 0),   "CENTER"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story.append(dscore_tbl)
    story.append(Spacer(1, 6*mm))

    # ── [시각화] 공시 의지(S) vs 행동(D-Score) 대비 ──
    story.append(Paragraph("공시 의지(S) vs 행동(D-Score)", s["h2"]))
    story.append(_s_vs_d_chart(d.signal_score, d.score, grade_color))
    story.append(Paragraph(
        "말(공시)과 행동(특허·R&amp;D)의 격차. D-Score가 S보다 높으면 ‘숨은 진주’, "
        "낮으면 ‘거품’ 신호입니다.", s["small"]))
    story.append(Spacer(1, 5*mm))

    # ── [시각화] CashMap 신호 강도 추이 ──
    story.append(Paragraph("CashMap 신호 강도 추이", s["h2"]))
    trend_dwg = _trend_chart(d.signal_trend)
    if trend_dwg is not None:
        story.append(trend_dwg)
    else:
        story.append(Paragraph("신호 이력 데이터 수집 중입니다.", s["small"]))
    story.append(Spacer(1, 5*mm))

    # ── [시각화] 신호 카테고리 분해 ──
    cat_head = "신호 카테고리 분해"
    if d.latest_disclosure_title:
        cat_head += f" — 최신 공시: {d.latest_disclosure_title}"
    story.append(Paragraph(cat_head, s["h2"]))
    donut = _category_donut(d.category_scores)
    if donut is not None:
        story.append(donut)
    else:
        story.append(Paragraph("카테고리 분해 데이터 수집 중입니다.", s["small"]))
    story.append(Spacer(1, 6*mm))

    # ── 피처 ──
    story.append(Paragraph("피처별 수치", s["h2"]))
    def _fmt(v, suffix="", signed=False):
        if v is None: return "-"
        if signed:    return f"{'+' if v > 0 else ''}{v}{suffix}"
        return f"{v}{suffix}"
    feature_rows = [
        ["피처",              "수치"],
        ["살아있는 특허 수",   _fmt(d.patent_count, "건")],
        ["IPC Shannon Entropy", f"H = {d.ipc_entropy:.1f}" if d.ipc_entropy is not None else "-"],
        ["R&D 투자 비중",       _fmt(d.rd_ratio, "%")],
        ["R&D YoY 성장률",     _fmt(d.rd_growth, "%", signed=True)],
        ["발명자 수 YoY",      _fmt(d.inventor_growth, "%", signed=True)],
        ["영업이익률 기울기",  _fmt(d.op_margin_slope, "", signed=True)],
    ]
    feat_tbl = Table(feature_rows, colWidths=[90*mm, 68*mm])
    feat_tbl.setStyle(TableStyle([
        ("FONT",            (0, 0), (-1, 0),  "NanumBold", 10),
        ("BACKGROUND",      (0, 0), (-1, 0),  COLOR_LIGHT),
        ("FONT",            (0, 1), (-1, -1), "Nanum", 10),
        ("TEXTCOLOR",       (0, 1), (0, -1),  COLOR_MUTED),
        ("BOX",             (0, 0), (-1, -1), 0.5, COLOR_BORDER),
        ("INNERGRID",       (0, 0), (-1, -1), 0.3, COLOR_BORDER),
        ("LEFTPADDING",     (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",    (0, 0), (-1, -1), 8),
        ("TOPPADDING",      (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING",   (0, 0), (-1, -1), 5),
    ]))
    story.append(feat_tbl)
    story.append(Spacer(1, 6*mm))

    # ── AI 분석 제언 (서사) / 없으면 룰베이스 추천 사유 ──
    if d.narrative:
        story += _narrative_flowables(d, s)
    else:
        story.append(Paragraph("RM 액션 추천", s["h2"]))
        rec_tbl = Table([[Paragraph(d.recommendation, s["recBox"])]], colWidths=[158*mm])
        rec_tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), colors.HexColor("#dcfce7")),
            ("BOX",           (0, 0), (-1, -1), 0.5, COLOR_SUCCESS),
            ("LEFTPADDING",   (0, 0), (-1, -1), 12),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
            ("TOPPADDING",    (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(KeepTogether(rec_tbl))
    story.append(Spacer(1, 6*mm))

    # ── 핵심 신호 문장 발췌 (하이라이트) ──
    if d.highlights:
        head = "공시 핵심 신호 문장"
        if d.highlight_source:
            head += f" — {d.highlight_source}"
        story.append(Paragraph(head, s["h2"]))

        # 신호 강도 높은 순 상위 5문장
        top = sorted(d.highlights, key=lambda h: h.get("score", 0), reverse=True)[:5]
        hl_rows = [["신호 문장", "강도", "유형"]]
        for h in top:
            sentence = (h.get("sentence") or "").strip()
            score    = h.get("score")
            cat      = h.get("category") or "-"
            hl_rows.append([
                Paragraph(sentence, s["body"]),
                f"{score:.2f}" if isinstance(score, (int, float)) else "-",
                cat,
            ])
        hl_tbl = Table(hl_rows, colWidths=[118*mm, 18*mm, 22*mm])
        hl_tbl.setStyle(TableStyle([
            ("FONT",            (0, 0), (-1, 0),  "NanumBold", 10),
            ("BACKGROUND",      (0, 0), (-1, 0),  COLOR_LIGHT),
            ("FONT",            (0, 1), (-1, -1), "Nanum", 9),
            ("TEXTCOLOR",       (1, 1), (2, -1),  COLOR_MUTED),
            ("ALIGN",           (1, 0), (2, -1),  "CENTER"),
            ("VALIGN",          (0, 0), (-1, -1), "MIDDLE"),
            ("BOX",             (0, 0), (-1, -1), 0.5, COLOR_BORDER),
            ("INNERGRID",       (0, 0), (-1, -1), 0.3, COLOR_BORDER),
            ("LEFTPADDING",     (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",    (0, 0), (-1, -1), 6),
            ("TOPPADDING",      (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING",   (0, 0), (-1, -1), 5),
        ]))
        story.append(hl_tbl)
        story.append(Spacer(1, 6*mm))

    # ── 푸터 ──
    story.append(Paragraph(
        "본 리포트는 NOVA 플랫폼이 자동 생성한 참고 자료이며, "
        "최종 여신 의사결정은 RM·심사역의 판단을 따릅니다.",
        s["small"]
    ))

    doc.build(story)
    buf.seek(0)
    return buf


# ── 추천 사유 룰베이스 ────────────────────────────
def build_recommendation(d: ReportData) -> str:
    """피처 값 기반 한국어 추천 사유. (향후 LLM 교체 가능)"""
    parts = []

    if d.score is None:
        msg = "<b>데이터 수집 중:</b> 현재 D-Score 산출 데이터(특허·재무)가 부족합니다."
        if d.signal_score is not None:
            msg += (f" 다만 CashMap 공시 신호 강도 S={d.signal_score:.2f}가 관측되어, "
                    "특허·재무 데이터 확보 후 리포트 재생성을 권장합니다.")
        else:
            msg += " 특허 및 재무 데이터 수집 후 재생성을 권장합니다."
        return msg

    if d.grade == "POSITIVE":
        parts.append(f"<b>접촉 추천:</b> D-Score {d.score:.2f}으로 상위 구간.")
        if d.rd_growth and d.rd_growth > 10:
            parts.append(f"R&amp;D 투자 YoY +{d.rd_growth}% — 말보다 행동이 앞서는 기업.")
        if d.patent_count and d.patent_count > 30:
            parts.append(f"살아있는 특허 {d.patent_count}건 유지 — 기술 방어력 확보.")
        if d.signal_score and d.signal_score > 0.7:
            parts.append(f"앵커 공시 신호 강도 {d.signal_score:.2f} — 수혜 기대 직전 구간.")
        parts.append("타행 선점 전 접촉 권장.")

    elif d.grade == "NEGATIVE":
        parts.append(f"<b>주의:</b> D-Score {d.score:.2f}, 거품 신호 감지.")
        if d.signal_score and d.signal_score > d.score + 0.2:
            parts.append(f"공시 의지(S={d.signal_score:.2f})가 실제 행동지표를 크게 앞섬 — 텍스트 과잉.")
        if d.rd_growth and d.rd_growth < 0:
            parts.append(f"R&amp;D 투자 YoY {d.rd_growth}% — 투자 위축.")
        parts.append("여신 한도 재점검 + 후속 공시 모니터링 필요.")

    else:  # MONITOR
        parts.append(f"<b>관찰:</b> D-Score {d.score:.2f}, 중립 구간.")
        parts.append("후속 분기 실적·공시 확인 후 판단.")

    if d.is_partial:
        parts.append("<font color='#d97706'>※ 일부 피처 누락 — 부분 스코어 기반 판단.</font>")

    return " ".join(parts)
