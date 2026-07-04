/* ============================================================================
 *  공급망 네온 지도 (1·2·3차 뚜렷한 구분)
 *  항상 다크 네온. 노드색=등급, 노드형태/크기/링거리=협력 차수
 * ========================================================================== */
function A4Network({ onSelectCompany, selectedId, focusCg, setFocusCg, mode, setMode }) {
  const { conglomerates, companies, byId } = window.ADE;
  const { GIcon, GPill } = window.G;

  const NEON = { cyan: '#00d4ff', POSITIVE: '#00e5a0', NEGATIVE: '#ff4d6d', MONITOR: '#f5a623' };
  const nodeColor = (n) => n.type === 'hub' ? NEON.cyan : NEON[n.grade];

  const wrapRef = useRef(null);
  const [dim, setDim] = useState({ w: 1000, h: 620 });
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((e) => { const r = e[0].contentRect; setDim({ w: Math.max(480, r.width), h: Math.max(400, r.height) }); });
    ro.observe(wrapRef.current); return () => ro.disconnect();
  }, []);

  const lay = useMemo(() => a4Layout(focusCg, dim, conglomerates, companies), [focusCg, dim]);

  // hover 시 강조할 경로(노드↔허브) 판정
  const isEdgeActive = (e) => {
    const a = lay.nodes[e.from], b = lay.nodes[e.to];
    return hover === a.id || hover === b.id || selectedId === a.id || selectedId === b.id;
  };

  return (
    <div className="g-pad g-up" style={{ height: '100%', display: 'flex', flexDirection: 'column', maxWidth: 'none' }}>
      {/* 헤더(테마 따름) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>공급망 지도</div>
          <h1 className="g-head" style={{ fontSize: 24, margin: 0 }}>누가 누구에게 연결돼 있나요?</h1>
          <p className="tx-2" style={{ fontSize: 13.5, margin: '6px 0 0', maxWidth: 600 }}>
            가운데가 <b>대기업</b>, 바깥으로 갈수록 먼 협력사입니다. <b style={{ color: 'var(--brand-tx)' }}>1차</b>는 크고 밝게, <b>2차</b>는 중간, <b>3차</b>는 작고 점선으로 표시돼요. 점을 클릭하면 자세히 볼 수 있어요.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          {setMode && (
            <div className="g-seg">
              <button className={mode === '2d' ? 'on' : ''} onClick={() => setMode('2d')}>2D</button>
              <button className={mode === '3d' ? 'on' : ''} onClick={() => setMode('3d')}>3D</button>
            </div>
          )}
          <button className="a4-chip" style={{ ...(focusCg ? {} : { borderColor: '#00d4ff', color: '#00d4ff', background: 'rgba(0,212,255,.12)' }) }} onClick={() => setFocusCg(null)}>전체 보기</button>
          {conglomerates.map((cg) => <button key={cg.id} className={`a4-chip ${focusCg === cg.id ? 'on' : ''}`} onClick={() => setFocusCg(cg.id)}>{cg.name}</button>)}
        </div>
      </div>

      {/* 네온 맵 */}
      <div ref={wrapRef} className="a4-map">
        {/* 등급 범례 */}
        <div className="a4-legend" style={{ left: 16, top: 16 }}>
          <div className="lg-title">색 = 등급</div>
          {[['POSITIVE', '숨은 진주'], ['NEGATIVE', '거품 경보'], ['MONITOR', '모니터링']].map(([k, l]) => (
            <div className="lg-row" key={k}><span style={{ width: 11, height: 11, borderRadius: '50%', background: NEON[k], boxShadow: `0 0 8px ${NEON[k]}` }} />{l}</div>
          ))}
          <div className="lg-row" style={{ marginTop: 9 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: NEON.cyan, boxShadow: `0 0 8px ${NEON.cyan}` }} />대기업 허브</div>
        </div>

        {/* 차수 범례 */}
        <div className="a4-legend" style={{ right: 16, top: 16, width: 186 }}>
          <div className="lg-title">크기·모양 = 협력 차수</div>
          <div className="lg-row"><TierGlyph tier={1} /> <b style={{ color: '#dcebf6', fontWeight: 600 }}>1차</b> <span style={{ color: '#6b8294', fontSize: 11 }}>직접 납품</span></div>
          <div className="lg-row"><TierGlyph tier={2} /> <b style={{ color: '#dcebf6', fontWeight: 600 }}>2차</b> <span style={{ color: '#6b8294', fontSize: 11 }}>중간 단계</span></div>
          <div className="lg-row"><TierGlyph tier={3} /> <b style={{ color: '#dcebf6', fontWeight: 600 }}>3차</b> <span style={{ color: '#6b8294', fontSize: 11 }}>말단 협력</span></div>
        </div>

        <svg className="a4-svg" width="100%" height="100%" viewBox={`0 0 ${dim.w} ${dim.h}`}>
          <defs>
            {Object.entries(NEON).map(([k, c]) => (
              <radialGradient key={k} id={`a4glow-${k}`}><stop offset="0" stopColor={c} stopOpacity=".55" /><stop offset="1" stopColor={c} stopOpacity="0" /></radialGradient>
            ))}
          </defs>

          {/* 차수 가이드 링 (포커스 모드) */}
          {lay.rings && lay.rings.map((ring, i) => (
            <g key={i}>
              <circle cx={ring.cx} cy={ring.cy} r={ring.r} fill="none" stroke="rgba(0,212,255,.16)" strokeWidth="1" strokeDasharray="2 7" />
              <text x={ring.cx} y={ring.cy - ring.r - 7} textAnchor="middle" style={{ fontFamily: 'DM Mono, monospace', fontSize: 10.5, letterSpacing: '.1em', fill: 'rgba(0,212,255,.55)' }}>{ring.tier}차 협력사</text>
            </g>
          ))}

          {/* 엣지 */}
          {lay.edges.map((e, i) => {
            const a = lay.nodes[e.from], b = lay.nodes[e.to];
            if (!a || !b) return null;
            const act = isEdgeActive(e);
            const col = nodeColor(b);
            const tier = b.tier || 1;
            const w = act ? 2.4 : (tier === 1 ? 1.5 : tier === 2 ? 1.1 : 0.8);
            const d = `M${a.x},${a.y} Q${(a.x + b.x) / 2 + (b.y - a.y) * 0.12},${(a.y + b.y) / 2 - (b.x - a.x) * 0.12} ${b.x},${b.y}`;
            return <path key={i} className={act ? 'a4-flow' : ''} d={d} fill="none" stroke={col}
              strokeWidth={w} strokeOpacity={act ? 0.85 : (tier === 3 ? 0.22 : 0.32)}
              strokeDasharray={act ? '5 6' : (tier === 3 ? '2 5' : 'none')}
              style={{ filter: act ? `drop-shadow(0 0 5px ${col})` : 'none', transition: 'stroke-opacity .2s' }} />;
          })}

          {/* 노드 */}
          {lay.nodes.map((n) => {
            const col = nodeColor(n);
            const act = hover === n.id || selectedId === n.id;
            return <A4Node key={n.id} n={n} col={col} active={act}
              onEnter={() => setHover(n.id)} onLeave={() => setHover(null)}
              onClick={() => n.type === 'hub' ? setFocusCg(focusCg === n.id ? null : n.id) : onSelectCompany(n.id)} />;
          })}
        </svg>

        {/* hover 카드 */}
        {hover && byId[hover] && (() => {
          const c = byId[hover];
          const col = NEON[c.grade];
          return (
            <div className="a4-hovercard" style={{ right: 16, top: 150, border: `1px solid ${col}55` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: '#eaf2f8' }}>{c.name}</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: col, border: `1px solid ${col}66`, borderRadius: 5, padding: '1px 7px' }}>{c.tier}차</span>
              </div>
              <div style={{ fontSize: 12, color: '#6b8294', marginBottom: 11 }}>{c.sector}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '.12em', color: '#6b8294' }}>D-SCORE</span>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 23, color: col, textShadow: `0 0 14px ${col}99` }}>{c.dScore}</span>
              </div>
            </div>
          );
        })()}

        <div style={{ position: 'absolute', right: 16, bottom: 13, zIndex: 4, fontSize: 11, color: '#5b7286', fontFamily: 'var(--g-f-mono)' }}>점 클릭 → 상세 · 허브 클릭 → 포커스</div>
      </div>
    </div>
  );
}

/* ---- 노드 렌더 (차수별 형태) ---- */
function A4Node({ n, col, active, onEnter, onLeave, onClick }) {
  const isHub = n.type === 'hub';
  const s = n.r * (active ? 1.16 : 1);
  const label = (isHub || active || n.r > (isHub ? 0 : 11));

  if (isHub) {
    return (
      <g transform={`translate(${n.x},${n.y})`} style={{ cursor: 'pointer' }} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick}>
        <circle r={s + 26} fill={`url(#a4glow-cyan)`} />
        <rect x={-s} y={-s} width={s * 2} height={s * 2} rx="5" fill="#08151f" stroke={col} strokeWidth="1.8" style={{ filter: `drop-shadow(0 0 12px ${col})` }} />
        <rect x={-s * 0.42} y={-s * 0.42} width={s * 0.84} height={s * 0.84} rx="2" fill={col} style={{ filter: `drop-shadow(0 0 6px ${col})` }} />
        <line x1={-s - 7} y1={0} x2={-s - 2} y2={0} stroke={col} strokeWidth="1.4" /><line x1={s + 2} y1={0} x2={s + 7} y2={0} stroke={col} strokeWidth="1.4" />
        <line x1={0} y1={-s - 7} x2={0} y2={-s - 2} stroke={col} strokeWidth="1.4" /><line x1={0} y1={s + 2} x2={0} y2={s + 7} stroke={col} strokeWidth="1.4" />
        <text y={s + 20} textAnchor="middle" style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, fill: '#eaf4fb', pointerEvents: 'none' }}>{n.name}</text>
        <text y={s + 35} textAnchor="middle" style={{ fontFamily: 'DM Mono, monospace', fontSize: 9.5, letterSpacing: '.08em', fill: '#5b7286', pointerEvents: 'none' }}>신호 {n.signal}</text>
      </g>
    );
  }

  const tier = n.tier;
  const glowR = tier === 1 ? s + 16 : tier === 2 ? s + 11 : s + 7;
  return (
    <g transform={`translate(${n.x},${n.y})`} style={{ cursor: 'pointer' }} onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick}>
      {(active || tier === 1) && <circle r={glowR} fill={`url(#a4glow-${n.grade})`} opacity={active ? 1 : .8} />}

      {tier === 1 && (
        <React.Fragment>
          <circle r={s + 4.5} fill="none" stroke={col} strokeWidth="1" strokeOpacity=".45" />
          <circle r={s} fill="#0a1822" stroke={col} strokeWidth={active ? 2.8 : 2.3} style={{ filter: `drop-shadow(0 0 10px ${col})` }} />
          <circle r={s * 0.5} fill={col} style={{ filter: `drop-shadow(0 0 5px ${col})` }} />
        </React.Fragment>
      )}
      {tier === 2 && (
        <React.Fragment>
          <circle r={s} fill="#0a1822" stroke={col} strokeWidth={active ? 2.4 : 1.9} style={{ filter: `drop-shadow(0 0 7px ${col}aa)` }} />
          <circle r={s * 0.4} fill={col} />
        </React.Fragment>
      )}
      {tier === 3 && (
        <React.Fragment>
          <circle r={s} fill="#08131c" stroke={col} strokeWidth={active ? 2 : 1.5} strokeDasharray="3 3" style={{ filter: `drop-shadow(0 0 5px ${col}88)` }} />
          <circle r={s * 0.28} fill={col} opacity=".85" />
        </React.Fragment>
      )}

      {/* 차수 배지 */}
      {(active || tier === 1) && (
        <text x={s + 4} y={-s - 1} style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, fontWeight: 500, fill: col, pointerEvents: 'none', opacity: .9 }}>{tier}차</text>
      )}
      {label && (
        <text y={s + 15} textAnchor="middle" style={{ fontFamily: 'Noto Sans KR, sans-serif', fontSize: tier === 3 ? 10.5 : 11.5, fontWeight: 600, fill: active ? '#fff' : '#9fb4c4', pointerEvents: 'none' }}>{n.name}</text>
      )}
    </g>
  );
}

/* 범례용 미니 글리프 */
function TierGlyph({ tier }) {
  const c = '#00d4ff';
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" style={{ flex: 'none' }}>
      {tier === 1 && <React.Fragment><circle cx="10" cy="10" r="8.5" fill="none" stroke={c} strokeWidth=".8" strokeOpacity=".4" /><circle cx="10" cy="10" r="6.5" fill="#0a1822" stroke={c} strokeWidth="1.6" /><circle cx="10" cy="10" r="3.2" fill={c} /></React.Fragment>}
      {tier === 2 && <React.Fragment><circle cx="10" cy="10" r="5.5" fill="#0a1822" stroke={c} strokeWidth="1.4" /><circle cx="10" cy="10" r="2.2" fill={c} /></React.Fragment>}
      {tier === 3 && <React.Fragment><circle cx="10" cy="10" r="4.5" fill="none" stroke={c} strokeWidth="1.2" strokeDasharray="2.5 2.5" /><circle cx="10" cy="10" r="1.4" fill={c} /></React.Fragment>}
    </svg>
  );
}

/* ---- 레이아웃 (차수 정보 + 가이드 링 포함) ---- */
function a4Layout(focusCg, dim, conglomerates, companies) {
  const cx = dim.w / 2, cy = dim.h / 2, nodes = [], edges = [], rings = [];
  const push = (n) => { nodes.push(n); return nodes.length - 1; };
  const base = Math.min(dim.w, dim.h);

  if (focusCg) {
    const cg = conglomerates.find((c) => c.id === focusCg);
    const hub = push({ id: cg.id, name: cg.name, type: 'hub', r: 21, signal: cg.signal, x: cx, y: cy });
    const ringR = { 1: base * 0.20, 2: base * 0.32, 3: base * 0.44 };
    const byTier = { 1: [], 2: [], 3: [] };
    companies.filter((c) => c.parent === focusCg).forEach((s) => byTier[s.tier].push(s));
    [1, 2, 3].forEach((tier) => { if (byTier[tier].length) rings.push({ cx, cy, r: ringR[tier], tier }); });
    const placed = { 1: [], 2: [], 3: [] };
    const tierR = { 1: 16, 2: 11.5, 3: 8.5 };  // 차수별 기본 크기
    [1, 2, 3].forEach((tier) => {
      const arr = byTier[tier], R = ringR[tier];
      arr.forEach((s, i) => {
        const ang = (i / Math.max(1, arr.length)) * Math.PI * 2 - Math.PI / 2 + tier * 0.5;
        const r = tierR[tier] + s.dScore / (tier === 1 ? 14 : tier === 2 ? 20 : 28);
        const ni = push({ id: s.id, name: s.name, type: 'node', grade: s.grade, tier, r, ang, x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R });
        placed[tier].push({ ang, ni });
        if (tier === 1) edges.push({ from: hub, to: ni });
        else { const ps = placed[tier - 1].length ? placed[tier - 1] : placed[1]; let best = ps[0], bd = 9; ps.forEach((p) => { const d = Math.abs(a4Ang(p.ang, ang)); if (d < bd) { bd = d; best = p; } }); edges.push({ from: best ? best.ni : hub, to: ni }); }
      });
    });
  } else {
    const hubR = base * 0.33;
    const tierR = { 1: 13, 2: 9.5, 3: 7 };
    conglomerates.forEach((cg, ci) => {
      const ha = (ci / conglomerates.length) * Math.PI * 2 - Math.PI / 2;
      const hx = cx + Math.cos(ha) * hubR, hy = cy + Math.sin(ha) * hubR;
      const hub = push({ id: cg.id, name: cg.name, type: 'hub', r: 15, signal: cg.signal, x: hx, y: hy });
      const sups = companies.filter((c) => c.parent === cg.id);
      sups.forEach((s, i) => {
        const spread = Math.PI * 1.05;
        const a = ha - spread / 2 + (sups.length > 1 ? (i / (sups.length - 1)) * spread : 0);
        const rr = base * 0.08 + s.tier * base * 0.046;
        const r = tierR[s.tier] + s.dScore / 22;
        const ni = push({ id: s.id, name: s.name, type: 'node', grade: s.grade, tier: s.tier, r, x: hx + Math.cos(a) * rr, y: hy + Math.sin(a) * rr });
        edges.push({ from: hub, to: ni });
      });
    });
  }
  return { nodes, edges, rings };
}
function a4Ang(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

window.A4Network = A4Network;
