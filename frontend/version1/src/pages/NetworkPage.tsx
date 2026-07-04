import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useNetwork, useCompanies, useSignalSummary } from "../hooks";
import { toNeonGraph, type NeonHub, type NeonNode } from "../lib/adapt";
import type { Grade } from "../components/guide";

const NEON: Record<string, string> = { cyan: "#00d4ff", POSITIVE: "#00e5a0", NEGATIVE: "#ff4d6d", MONITOR: "#f5a623" };

interface LayNode { id: string; name: string; type: "hub" | "node"; r: number; x: number; y: number; signal?: number; grade?: Grade; tier?: number; ang?: number }
interface LayEdge { from: number; to: number }
interface Ring { cx: number; cy: number; r: number; tier: number }

function angDiff(a: number, b: number) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

/* 단일 허브 포커스 레이아웃 (백엔드는 앵커별 그래프 제공) */
function focusLayout(hub: NeonHub, companies: NeonNode[], dim: { w: number; h: number }) {
  const cx = dim.w / 2, cy = dim.h / 2;
  const nodes: LayNode[] = [];
  const edges: LayEdge[] = [];
  const rings: Ring[] = [];
  const base = Math.min(dim.w, dim.h);
  const push = (n: LayNode) => { nodes.push(n); return nodes.length - 1; };

  const hubIdx = push({ id: hub.id, name: hub.name, type: "hub", r: 21, signal: hub.signal, x: cx, y: cy });
  const ringR: Record<number, number> = { 1: base * 0.2, 2: base * 0.32, 3: base * 0.44 };
  const byTier: Record<number, NeonNode[]> = { 1: [], 2: [], 3: [] };
  companies.forEach((s) => byTier[s.tier]?.push(s));
  [1, 2, 3].forEach((t) => { if (byTier[t].length) rings.push({ cx, cy, r: ringR[t], tier: t }); });

  const placed: Record<number, { ang: number; ni: number }[]> = { 1: [], 2: [], 3: [] };
  const tierR: Record<number, number> = { 1: 16, 2: 11.5, 3: 8.5 };
  [1, 2, 3].forEach((tier) => {
    const arr = byTier[tier], R = ringR[tier];
    arr.forEach((s, i) => {
      const ang = (i / Math.max(1, arr.length)) * Math.PI * 2 - Math.PI / 2 + tier * 0.5;
      const r = tierR[tier] + s.dScore / (tier === 1 ? 14 : tier === 2 ? 20 : 28);
      const ni = push({ id: s.id, name: s.name, type: "node", grade: s.grade, tier, r, ang, x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R });
      placed[tier].push({ ang, ni });
      if (tier === 1) edges.push({ from: hubIdx, to: ni });
      else {
        const ps = placed[tier - 1].length ? placed[tier - 1] : placed[1];
        let best = ps[0], bd = 9;
        ps.forEach((p) => { const d = Math.abs(angDiff(p.ang, ang)); if (d < bd) { bd = d; best = p; } });
        edges.push({ from: best ? best.ni : hubIdx, to: ni });
      }
    });
  });
  return { nodes, edges, rings };
}

function TierGlyph({ tier }: { tier: number }) {
  const c = "#00d4ff";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" style={{ flex: "none" }}>
      {tier === 1 && <><circle cx="10" cy="10" r="8.5" fill="none" stroke={c} strokeWidth=".8" strokeOpacity=".4" /><circle cx="10" cy="10" r="6.5" fill="#0a1822" stroke={c} strokeWidth="1.6" /><circle cx="10" cy="10" r="3.2" fill={c} /></>}
      {tier === 2 && <><circle cx="10" cy="10" r="5.5" fill="#0a1822" stroke={c} strokeWidth="1.4" /><circle cx="10" cy="10" r="2.2" fill={c} /></>}
      {tier === 3 && <><circle cx="10" cy="10" r="4.5" fill="none" stroke={c} strokeWidth="1.2" strokeDasharray="2.5 2.5" /><circle cx="10" cy="10" r="1.4" fill={c} /></>}
    </svg>
  );
}

function MapNode({ n, col, active, onEnter, onLeave, onClick }: { n: LayNode; col: string; active: boolean; onEnter: () => void; onLeave: () => void; onClick: () => void }) {
  const isHub = n.type === "hub";
  const s = n.r * (active ? 1.16 : 1);
  if (isHub) {
    return (
      <g transform={`translate(${n.x},${n.y})`} style={{ cursor: "pointer" }} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick}>
        <circle r={s + 26} fill="url(#a4glow-cyan)" />
        <rect x={-s} y={-s} width={s * 2} height={s * 2} rx="5" fill="#08151f" stroke={col} strokeWidth="1.8" style={{ filter: `drop-shadow(0 0 12px ${col})` }} />
        <rect x={-s * 0.42} y={-s * 0.42} width={s * 0.84} height={s * 0.84} rx="2" fill={col} style={{ filter: `drop-shadow(0 0 6px ${col})` }} />
        <text y={s + 20} textAnchor="middle" style={{ fontFamily: "Syne, sans-serif", fontSize: 14, fontWeight: 700, fill: "#eaf4fb", pointerEvents: "none" }}>{n.name}</text>
        {!!n.signal && <text y={s + 35} textAnchor="middle" style={{ fontFamily: "DM Mono, monospace", fontSize: 9.5, letterSpacing: ".08em", fill: "#5b7286", pointerEvents: "none" }}>신호 {n.signal}</text>}
      </g>
    );
  }
  const tier = n.tier ?? 1;
  const glowR = tier === 1 ? s + 16 : tier === 2 ? s + 11 : s + 7;
  return (
    <g transform={`translate(${n.x},${n.y})`} style={{ cursor: "pointer" }} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick}>
      {(active || tier === 1) && <circle r={glowR} fill={`url(#a4glow-${n.grade})`} opacity={active ? 1 : 0.8} />}
      {tier === 1 && (
        <>
          <circle r={s + 4.5} fill="none" stroke={col} strokeWidth="1" strokeOpacity=".45" />
          <circle r={s} fill="#0a1822" stroke={col} strokeWidth={active ? 2.8 : 2.3} style={{ filter: `drop-shadow(0 0 10px ${col})` }} />
          <circle r={s * 0.5} fill={col} style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
        </>
      )}
      {tier === 2 && (
        <>
          <circle r={s} fill="#0a1822" stroke={col} strokeWidth={active ? 2.4 : 1.9} style={{ filter: `drop-shadow(0 0 7px ${col}aa)` }} />
          <circle r={s * 0.4} fill={col} />
        </>
      )}
      {tier === 3 && (
        <>
          <circle r={s} fill="#08131c" stroke={col} strokeWidth={active ? 2 : 1.5} strokeDasharray="3 3" style={{ filter: `drop-shadow(0 0 5px ${col}88)` }} />
          <circle r={s * 0.28} fill={col} opacity=".85" />
        </>
      )}
      {(active || tier === 1) && <text x={s + 4} y={-s - 1} style={{ fontFamily: "DM Mono, monospace", fontSize: 9, fontWeight: 500, fill: col, pointerEvents: "none", opacity: 0.9 }}>{tier}차</text>}
      <text y={s + 15} textAnchor="middle" style={{ fontFamily: "Noto Sans KR, sans-serif", fontSize: tier === 3 ? 10.5 : 11.5, fontWeight: 600, fill: active ? "#fff" : "#9fb4c4", pointerEvents: "none" }}>{n.name}</text>
    </g>
  );
}

export default function NetworkPage() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { data: anchorsData } = useCompanies({ is_anchor: true });
  const { data: signalSummary } = useSignalSummary();

  const anchors = (anchorsData ?? []) as any[];
  const [focusId, setFocusId] = useState<string | null>(companyId ?? null);
  useEffect(() => { if (companyId) setFocusId(companyId); }, [companyId]);

  // 기본 포커스: 라우트 → 첫 앵커 → "1"
  const effectiveId = focusId ?? (anchors[0]?.id != null ? String(anchors[0].id) : "1");
  const { data, loading, error } = useNetwork(effectiveId);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: 1000, h: 620 });
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((e) => { const r = e[0].contentRect; setDim({ w: Math.max(480, r.width), h: Math.max(400, r.height) }); });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const graph = useMemo(() => toNeonGraph(data), [data]);
  const hub: NeonHub | undefined = graph.conglomerates[0];

  // 허브 신호 강도 보강 (signal summary)
  const hubSignal = useMemo(() => {
    if (!hub) return 0;
    const m = (signalSummary ?? []).find((s: any) => s.corp_code === hub.id);
    return m ? Math.round((m.latest_score ?? 0) * (m.latest_score <= 1 ? 100 : 1)) : 0;
  }, [hub, signalSummary]);

  const lay = useMemo(() => {
    if (!hub) return { nodes: [] as LayNode[], edges: [] as LayEdge[], rings: [] as Ring[] };
    return focusLayout({ ...hub, signal: hubSignal }, graph.companies, dim);
  }, [hub, hubSignal, graph.companies, dim]);

  const byId = useMemo(() => {
    const m: Record<string, NeonNode> = {};
    graph.companies.forEach((c) => { m[c.id] = c; });
    return m;
  }, [graph.companies]);

  const nodeColor = (n: LayNode) => (n.type === "hub" ? NEON.cyan : NEON[n.grade ?? "MONITOR"]);
  const isEdgeActive = (e: LayEdge) => {
    const a = lay.nodes[e.from], b = lay.nodes[e.to];
    return hover === a?.id || hover === b?.id || selected === a?.id || selected === b?.id;
  };

  // company_id 매핑 (상세 이동)
  const idByCode = useMemo(() => {
    const m: Record<string, number> = {};
    (signalSummary ?? []).forEach((s: any) => { if (s.company_id != null) m[s.corp_code] = s.company_id; });
    return m;
  }, [signalSummary]);
  const openCompany = (corpCode: string) => { const cid = idByCode[corpCode]; if (cid != null) navigate(`/company/${cid}`); };

  return (
    <div className="g-pad g-up" style={{ height: "100%", display: "flex", flexDirection: "column", maxWidth: "none" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>공급망 지도</div>
          <h1 className="g-head" style={{ fontSize: 24, margin: 0 }}>누가 누구에게 연결돼 있나요?</h1>
          <p className="tx-2" style={{ fontSize: 13.5, margin: "6px 0 0", maxWidth: 600 }}>
            가운데가 <b>대기업</b>, 바깥으로 갈수록 먼 협력사입니다. <b style={{ color: "var(--brand-tx)" }}>1차</b>는 크고 밝게, <b>2차</b>는 중간, <b>3차</b>는 작고 점선으로 표시돼요.
          </p>
        </div>
        {anchors.length > 0 && (
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {anchors.map((cg) => (
              <button key={cg.id} className={`a4-chip ${String(cg.id) === effectiveId ? "on" : ""}`} onClick={() => setFocusId(String(cg.id))}>{cg.corp_name}</button>
            ))}
          </div>
        )}
      </div>

      <div ref={wrapRef} className="a4-map">
        {/* 등급 범례 */}
        <div className="a4-legend" style={{ left: 16, top: 16 }}>
          <div className="lg-title">색 = 등급</div>
          {([["POSITIVE", "숨은 진주"], ["NEGATIVE", "거품 경보"], ["MONITOR", "모니터링"]] as [string, string][]).map(([k, l]) => (
            <div className="lg-row" key={k}><span style={{ width: 11, height: 11, borderRadius: "50%", background: NEON[k], boxShadow: `0 0 8px ${NEON[k]}` }} />{l}</div>
          ))}
          <div className="lg-row" style={{ marginTop: 9 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: NEON.cyan, boxShadow: `0 0 8px ${NEON.cyan}` }} />대기업 허브</div>
        </div>

        {/* 차수 범례 */}
        <div className="a4-legend" style={{ right: 16, top: 16, width: 186 }}>
          <div className="lg-title">크기·모양 = 협력 차수</div>
          <div className="lg-row"><TierGlyph tier={1} /> <b style={{ color: "#dcebf6", fontWeight: 600 }}>1차</b> <span style={{ color: "#6b8294", fontSize: 11 }}>직접 납품</span></div>
          <div className="lg-row"><TierGlyph tier={2} /> <b style={{ color: "#dcebf6", fontWeight: 600 }}>2차</b> <span style={{ color: "#6b8294", fontSize: 11 }}>중간 단계</span></div>
          <div className="lg-row"><TierGlyph tier={3} /> <b style={{ color: "#dcebf6", fontWeight: 600 }}>3차</b> <span style={{ color: "#6b8294", fontSize: 11 }}>말단 협력</span></div>
        </div>

        <svg className="a4-svg" width="100%" height="100%" viewBox={`0 0 ${dim.w} ${dim.h}`}>
          <defs>
            {Object.entries(NEON).map(([k, c]) => (
              <radialGradient key={k} id={`a4glow-${k}`}><stop offset="0" stopColor={c} stopOpacity=".55" /><stop offset="1" stopColor={c} stopOpacity="0" /></radialGradient>
            ))}
          </defs>

          {lay.rings.map((ring, i) => (
            <g key={i}>
              <circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke="rgba(0,212,255,.16)" strokeWidth="1" strokeDasharray="2 7" />
              <text x={ring.cx} y={ring.cy - ring.r - 7} textAnchor="middle" style={{ fontFamily: "DM Mono, monospace", fontSize: 10.5, letterSpacing: ".1em", fill: "rgba(0,212,255,.55)" }}>{ring.tier}차 협력사</text>
            </g>
          ))}

          {lay.edges.map((e, i) => {
            const a = lay.nodes[e.from], b = lay.nodes[e.to];
            if (!a || !b) return null;
            const act = isEdgeActive(e);
            const col = nodeColor(b);
            const tier = b.tier || 1;
            const w = act ? 2.4 : tier === 1 ? 1.5 : tier === 2 ? 1.1 : 0.8;
            const d = `M${a.x},${a.y} Q${(a.x + b.x) / 2 + (b.y - a.y) * 0.12},${(a.y + b.y) / 2 - (b.x - a.x) * 0.12} ${b.x},${b.y}`;
            return <path key={i} className={act ? "a4-flow" : ""} d={d} fill="none" stroke={col}
              strokeWidth={w} strokeOpacity={act ? 0.85 : tier === 3 ? 0.22 : 0.32}
              strokeDasharray={act ? "5 6" : tier === 3 ? "2 5" : "none"}
              style={{ filter: act ? `drop-shadow(0 0 5px ${col})` : "none", transition: "stroke-opacity .2s" }} />;
          })}

          {lay.nodes.map((n) => {
            const col = nodeColor(n);
            const act = hover === n.id || selected === n.id;
            return <MapNode key={n.id} n={n} col={col} active={act}
              onEnter={() => setHover(n.id)} onLeave={() => setHover(null)}
              onClick={() => (n.type === "hub" ? setSelected(null) : (setSelected(n.id), openCompany(n.id)))} />;
          })}
        </svg>

        {/* hover 카드 */}
        {hover && byId[hover] && (() => {
          const c = byId[hover];
          const col = NEON[c.grade];
          return (
            <div className="a4-hovercard" style={{ right: 16, top: 150, border: `1px solid ${col}55` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: "#eaf2f8" }}>{c.name}</span>
                <span style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: col, border: `1px solid ${col}66`, borderRadius: 5, padding: "1px 7px" }}>{c.tier}차</span>
              </div>
              <div style={{ fontSize: 12, color: "#6b8294", marginBottom: 11 }}>{c.sector ?? "협력사"}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "DM Mono, monospace", fontSize: 10, letterSpacing: ".12em", color: "#6b8294" }}>연결강도</span>
                <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 23, color: col, textShadow: `0 0 14px ${col}99` }}>{c.dScore}</span>
              </div>
            </div>
          );
        })()}

        {/* 상태 오버레이 */}
        {(loading || error || (!loading && lay.nodes.length <= 1)) && (
          <div style={{ position: "absolute", inset: 0, zIndex: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#9fb4c4", fontSize: 13.5, textAlign: "center", padding: 24 }}>
            {loading ? "공급망 네트워크 로딩 중…" : error ? `⚠ ${error}` : "등록된 공급망 관계가 없습니다."}
          </div>
        )}

        <div style={{ position: "absolute", right: 16, bottom: 13, zIndex: 4, fontSize: 11, color: "#5b7286", fontFamily: "var(--g-f-mono)" }}>점 클릭 → 상세 보기</div>
      </div>
    </div>
  );
}
