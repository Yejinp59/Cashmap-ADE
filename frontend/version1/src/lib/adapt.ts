/* ============================================================================
 *  백엔드 응답 → "가이드" 새 디자인이 기대하는 형태로 변환하는 어댑터
 *  - 백엔드가 비운 필드(D-Score/등급/괴리/피처)는 호출부에서 graceful empty 처리
 *  - 점수 스케일: 백엔드 s_score / latest_score / reverse score 는 0~1 → 0~100 으로 변환
 * ========================================================================== */
import type { Grade } from "../components/guide";

/** 0~1 (혹은 이미 0~100) 점수를 0~100 정수로 정규화 */
export function pct(x: number | null | undefined): number {
  if (x == null) return 0;
  const v = x <= 1 ? x * 100 : x;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export const TREND_KOR: Record<string, string> = { UP: "상승", DOWN: "하락", STABLE: "보합" };

/* ── 대기업 신호 패널 (대시보드 우측) ──────────────────
 *  GET /api/cashmap/signal/summary → SignalSummary[]
 */
export interface CongSignal {
  id: string;          // corp_code
  companyId?: number;
  name: string;
  signal: number;      // 0~100
  trend: string;       // UP/DOWN/STABLE
  theme: string;       // 표시용 보조 텍스트
}

export function toCongSignals(summary: any[] | null | undefined): CongSignal[] {
  return (summary ?? []).map((s) => ({
    id: s.corp_code,
    companyId: s.company_id ?? undefined,
    name: s.company_name,
    signal: pct(s.latest_score),
    trend: s.trend ?? "STABLE",
    theme: `최신 신호 ${pct(s.latest_score)} · ${TREND_KOR[s.trend] ?? "보합"} 추세`,
  }));
}

/* ── 역방향 조회 결과 ──────────────────────────────────
 *  POST /api/reverse-query → ReverseQueryResult[]
 *  (등급/차수/상장여부/D-Score는 백엔드 미제공 → 호출부에서 graceful)
 */
export interface ReverseItem {
  rank: number;
  id: string;          // corp_code (네비게이션엔 company_id가 없어 corp_code 사용)
  name: string;
  score: number;       // 0~100
  reason: string;
  grade: Grade;        // 미제공 → MONITOR 기본
}

export function toReverseItems(results: any[] | null | undefined): ReverseItem[] {
  return (results ?? []).map((r) => ({
    rank: r.rank,
    id: r.corp_code,
    name: r.company_name,
    score: pct(r.score),
    reason: r.score_reason,
    grade: "MONITOR" as Grade,
  }));
}

/* ── 공급망 네온 지도 ──────────────────────────────────
 *  GET /api/cashmap/network/:id → { nodes, edges }
 *  네온 레이아웃이 쓰는 { conglomerates, companies } 형태로 변환.
 *  등급은 백엔드 미제공 → MONITOR 기본, dScore는 edge weight 로 근사.
 */
export interface NeonHub { id: string; name: string; signal: number }
export interface NeonNode {
  id: string;
  name: string;
  parent: string;      // hub corp_code
  tier: number;        // 1/2/3
  grade: Grade;
  dScore: number;      // 0~100 (weight 근사)
  sector?: string;
}
export interface NeonGraph { conglomerates: NeonHub[]; companies: NeonNode[] }

export function toNeonGraph(data: any): NeonGraph {
  const nodes: any[] = data?.nodes ?? [];
  const edges: any[] = data?.edges ?? [];
  const anchors = nodes.filter((n) => n.is_anchor);
  const primaryAnchor = anchors[0]?.id ?? nodes[0]?.id;

  // 노드별 tier / weight (해당 노드를 target 으로 하는 엣지 기준)
  const tierOf: Record<string, number> = {};
  const weightOf: Record<string, number> = {};
  const parentOf: Record<string, string> = {};
  edges.forEach((e) => {
    tierOf[e.target] = e.tier ?? tierOf[e.target] ?? 1;
    weightOf[e.target] = e.weight ?? weightOf[e.target] ?? 0.6;
    parentOf[e.target] = e.source;
  });

  const conglomerates: NeonHub[] = anchors.map((n) => ({
    id: n.id, name: n.name, signal: 0,
  }));
  // 앵커가 graph 에 없으면(노드만 있고 is_anchor 누락) 첫 노드를 허브로
  if (conglomerates.length === 0 && primaryAnchor) {
    const first = nodes.find((n) => n.id === primaryAnchor);
    if (first) conglomerates.push({ id: first.id, name: first.name, signal: 0 });
  }

  const companies: NeonNode[] = nodes
    .filter((n) => !n.is_anchor && n.id !== primaryAnchor)
    .map((n) => {
      const t = tierOf[n.id] ?? 1;
      return {
        id: n.id,
        name: n.name,
        parent: parentOf[n.id] ?? primaryAnchor,
        tier: t >= 1 && t <= 3 ? t : 1,
        grade: "MONITOR" as Grade,
        dScore: pct(weightOf[n.id]),
        sector: n.sector ?? undefined,
      };
    });

  return { conglomerates, companies };
}
