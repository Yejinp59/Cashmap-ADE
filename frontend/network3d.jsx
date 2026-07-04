/* ============================================================================
 *  공급망 3D 지도 — react-force-graph-3d (3d-force-graph / Three.js + WebGL)
 *    · 전체 대기업을 한 공간에 표시
 *    · 사용자가 드래그로 직접 회전 (OrbitControls 기본)
 *    · 노드 클릭 → 해당 노드 확대 + 카메라 포커스 + 기업 정보 패널
 *  A4NetworkView = 2D(A4Network) / 3D(A4Network3D) 토글 래퍼
 * ========================================================================== */
const NG_NEON = { hub: '#00d4ff', POSITIVE: '#00e5a0', NEGATIVE: '#ff4d6d', MONITOR: '#f5a623' };

function A4Network3D({ onSelectCompany, mode, setMode, focusCg }) {
  const { conglomerates, companies, byId, cgById } = window.ADE;
  const { GIcon } = window.G;
  const sections = window.ADE.sections || [];

  const mountRef = useRef(null);
  const graphRef = useRef(null);
  const selRef = useRef(null);       // 현재 선택 노드 id (particle 판정용)
  const prevNode = useRef(null);     // 직전 확대 노드(원복용)
  const [selId, setSelId] = useState(null);
  const [focusHubId, setFocusHubId] = useState(null);
  const [loading, setLoading] = useState(true);
  // 섹션 필터: 'all' 또는 sections[].key. (기업이 많아지면 섹션별로 골라 그려 가독성↑)
  // 기업 상세 → '공급망에서 보기'로 들어오면 그 기업 섹션으로 시작.
  const [section, setSection] = useState(() => {
    const s = focusCg && window.ADE.sectionByCg ? window.ADE.sectionByCg(focusCg) : null;
    return s ? s.key : 'all';
  });

  // ---- 그래프 데이터 (섹션 필터 반영) ----
  const data = useMemo(() => {
    const nodes = [], links = [];
    const cgs = section === 'all'
      ? conglomerates
      : conglomerates.filter((cg) => {
          const s = sections.find((x) => x.cg === cg.id || (x.cgs || []).includes(cg.id));   // 다중 앵커 섹션(반도체=삼성+하이닉스)
          return s && s.key === section;
        });
    const cgIds = new Set(cgs.map((cg) => cg.id));
    cgs.forEach((cg) => nodes.push({ id: cg.id, name: cg.name, type: 'hub', signal: cg.signal }));
    companies.forEach((c) => {
      if (!cgIds.has(c.parent)) return;
      nodes.push({ id: c.id, name: c.name, type: 'node', grade: c.grade, tier: c.tier, parent: c.parent });
    });
    const nodeIds = new Set(nodes.map((n) => n.id));
    // 사슬 구조: 대기업 → 1차 → 2차 → 3차.
    // 데이터엔 협력사가 '대기업 소속 + 차수'로만 들어와(상위 협력사 지정 없음),
    // 같은 대기업 안에서 차수별로 묶어 바로 위 차수 노드에 분배 연결한다.
    cgs.forEach((cg) => {
      const byTier = { 1: [], 2: [], 3: [] };
      companies.forEach((c) => { if (c.parent === cg.id && byTier[c.tier]) byTier[c.tier].push(c); });
      byTier[1].forEach((c) => links.push({ source: cg.id, target: c.id, tier: 1 }));
      [2, 3].forEach((t) => {
        const parents = byTier[t - 1].length ? byTier[t - 1] : (byTier[1].length ? byTier[1] : null);
        byTier[t].forEach((c, i) => {
          // 실 공급망(upstreamId)이 있으면 실제 상위 협력사에, 없으면(목업) 차수별 분배 연결
          const up = (c.upstreamId && nodeIds.has(c.upstreamId)) ? c.upstreamId
                   : (parents ? parents[i % parents.length].id : cg.id);
          links.push({ source: up, target: c.id, tier: t });
        });
      });
    });
    // 실 공급망 교차 연결 — 한 협력사가 두 앵커(삼성·하이닉스)와 모두 거래하는 경우
    companies.forEach((c) => {
      if (!cgIds.has(c.parent)) return;
      (c.crossCgs || []).forEach((cgid) => {
        if (cgIds.has(cgid)) links.push({ source: cgid, target: c.id, tier: c.tier || 1 });
      });
    });
    return { nodes, links };
  }, [section]);

  // 콜백/루프가 항상 최신 data 를 보도록 ref 동기화 (섹션 바뀌면 그래프 갱신)
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);
  const supplierCount = data.nodes.filter((n) => n.type === 'node').length;

  // ---- 접근자 (확대 애니메이션 반영) ----
  // nodeVal = 구의 '부피' → 반지름은 세제곱근에 비례. 차수 구분을 '심하게' 내려면
  // 값 격차를 크게 벌려야 한다. (반지름 ≈ nodeRelSize(4) × ∛val)
  //   hub ∛240≈6.2  · 1차 ∛54≈3.8 · 2차 ∛12≈2.3 · 3차 ∛2.6≈1.4  → 허브가 3차의 ~4.5배
  const baseVal = (n) => (n.type === 'hub' ? 240 : n.tier === 1 ? 54 : n.tier === 2 ? 12 : 2.6);
  const valOf = (n) => baseVal(n) * (n.__scale || 1);
  const colorOf = (n) => (n.type === 'hub' ? NG_NEON.hub : NG_NEON[n.grade]);
  const partOf = (l) => {
    const s = selRef.current; if (!s) return 0;
    const sid = (l.source && l.source.id) || l.source;
    const tid = (l.target && l.target.id) || l.target;
    return sid === s || tid === s ? 3 : 0;
  };
  const linkColorOf = (l) => {
    const t = (l.target && l.target.grade) ? l.target : byId[(l.target && l.target.id) || l.target];
    return t && t.grade ? NG_NEON[t.grade] : '#2a4a5e';
  };

  const refresh = () => { const G = graphRef.current; if (G) G.nodeVal(valOf); };

  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const animateScale = (node) => {
    if (prevNode.current && prevNode.current !== node) prevNode.current.__scale = 1;
    prevNode.current = node;
    const start = performance.now(), dur = 340, target = node.type === 'hub' ? 1.5 : 2.7;
    const step = (t) => {
      const k = Math.min(1, (t - start) / dur);
      node.__scale = 1 + (target - 1) * easeOut(k);
      refresh();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const focusCamera = (node, dist) => {
    const G = graphRef.current; if (!G) return;
    const r = Math.hypot(node.x || 0, node.y || 0, node.z || 0) || 1;
    const ratio = 1 + dist / r;
    G.cameraPosition({ x: (node.x || 0) * ratio, y: (node.y || 0) * ratio, z: (node.z || 0) * ratio }, node, 750);
  };

  const handleClick = (node, focus = false) => {
    const G = graphRef.current; if (!G) return;
    selRef.current = node.id;
    setSelId(node.type === 'hub' ? null : node.id);
    setFocusHubId(node.type === 'hub' ? node.id : null);
    animateScale(node);
    // 노드 클릭 시엔 카메라를 옮기지 않는다(포커싱 제거). 칩으로 이동할 때만 넉넉한 거리로.
    if (focus) focusCamera(node, node.type === 'hub' ? 320 : 260);
    G.linkDirectionalParticles(partOf);
  };

  const clearSel = () => {
    if (prevNode.current) { prevNode.current.__scale = 1; prevNode.current = null; }
    selRef.current = null; setSelId(null); setFocusHubId(null);
    refresh();
    const G = graphRef.current; if (G) G.linkDirectionalParticles(partOf);
  };

  // ---- 거리 기반 라벨 부착 (가까이 가면 기업명 표시) ----
  const makeLabel = (n) => {
    if (typeof SpriteText === 'undefined') return undefined;
    const isHub = n.type === 'hub';
    const label = new SpriteText(n.name);
    label.fontFace = 'Noto Sans KR, sans-serif';
    label.fontWeight = '600';
    label.color = isHub ? '#a9ecff' : '#e3eef7';
    label.backgroundColor = false;
    label.strokeWidth = 0.6;
    label.strokeColor = '#06121b';
    label.textHeight = isHub ? 11 : 6;
    label.material.depthWrite = false;
    label.material.transparent = true;
    label.material.opacity = isHub ? 1 : 0;
    // 노드가 커졌으므로 라벨을 노드 반지름 위로 띄운다 (겹침 방지)
    const r = 4 * Math.cbrt(baseVal(n));      // nodeRelSize(4) 반영 대략 반지름
    label.position.y = r + (isHub ? 11 : 6);
    label.visible = isHub;
    n.__label = label;
    return label;
  };

  // ---- 은하수 배경 (은은한 별무리) ----
  const buildGalaxy = () => {
    const THREE = window.THREE; if (!THREE) return null;
    const N = 1600;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 420 + Math.random() * 1150;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.42;        // 은하 평면처럼 살짝 납작하게
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const hue = 0.52 + (Math.random() * 0.16 - 0.05); // 청록~보라 미세 변주
      const c = new THREE.Color().setHSL(hue, 0.55, 0.55 + Math.random() * 0.4);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.82, depthWrite: false, blending: THREE.AdditiveBlending });
    return new THREE.Points(geo, mat);
  };

  // ---- 그래프 초기화 ----
  useEffect(() => {
    let raf, loopRaf, destroyed = false;
    const init = () => {
      if (destroyed) return;
      if (typeof ForceGraph3D === 'undefined') { raf = requestAnimationFrame(init); return; }
      const el = mountRef.current; if (!el) return;
      const Graph = ForceGraph3D({ controlType: 'orbit' })(el)
        .graphData(dataRef.current)
        .backgroundColor('#05070d')
        .showNavInfo(false)
        .nodeRelSize(4)
        .nodeOpacity(0.96)
        .nodeResolution(18)
        .nodeColor(colorOf)
        .nodeVal(valOf)
        .nodeThreeObjectExtend(true)
        .nodeThreeObject(makeLabel)
        .nodeLabel((n) => {
          if (n.type === 'hub') return `<div class="ng-tip"><b>${n.name}</b><span>대기업 허브 · 신호 ${n.signal}</span></div>`;
          const c = byId[n.id];
          return `<div class="ng-tip"><b>${c.name}</b><span>${c.tier}차 · ${c.sector} · D ${c.dScore}</span></div>`;
        })
        .linkColor(linkColorOf)
        .linkOpacity(0.55)
        .linkWidth((l) => (l.tier === 1 ? 3.2 : l.tier === 2 ? 2.2 : 1.4))
        .linkDirectionalParticles(partOf)
        .linkDirectionalParticleWidth(1.8)
        .linkDirectionalParticleSpeed(0.012)
        .onNodeClick((n) => handleClick(n))
        .onBackgroundClick(clearSel);

      // 노드가 커지고 사슬(대기업→1차→2차→3차)이라 간격을 넓혀 겹침 방지
      Graph.d3Force('charge').strength(-240);
      Graph.d3Force('link').distance((l) => 60 + (l.tier || 1) * 34);
      // 대기업 허브들끼리는 서로 강하게 밀어내 각자 영역(=각 생태계 사슬)을 갖게 한다
      Graph.d3Force('hubSpread', (alpha) => {
        const hubs = dataRef.current.nodes.filter((n) => n.type === 'hub');
        const k = 1400 * alpha;
        for (let i = 0; i < hubs.length; i++) {
          for (let j = i + 1; j < hubs.length; j++) {
            const a = hubs[i], b = hubs[j];
            let dx = (a.x || 0) - (b.x || 0), dy = (a.y || 0) - (b.y || 0), dz = (a.z || 0) - (b.z || 0);
            let d2 = dx * dx + dy * dy + dz * dz || 1;
            const f = k / d2, inv = 1 / Math.sqrt(d2);
            dx *= inv; dy *= inv; dz *= inv;
            a.vx += dx * f; a.vy += dy * f; a.vz += dz * f;
            b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
          }
        }
      });
      Graph.cameraPosition({ z: 360 });

      // 은하수 추가
      const stars = buildGalaxy();
      if (stars) Graph.scene().add(stars);

      graphRef.current = Graph;

      // 카메라 거리에 따라 협력사 라벨 페이드 인/아웃
      // 기본 카메라 z=360 보다 충분히 멀게 잡아 기본 시점에서도 이름이 보이도록
      const NEAR = 470, FAR = 900;
      const loop = () => {
        if (destroyed) return;
        const cam = Graph.camera();
        if (cam) {
          for (const n of dataRef.current.nodes) {
            const lb = n.__label; if (!lb || n.type === 'hub') continue;
            const dx = cam.position.x - (n.x || 0), dy = cam.position.y - (n.y || 0), dz = cam.position.z - (n.z || 0);
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const op = dist <= NEAR ? 1 : dist >= FAR ? 0 : 1 - (dist - NEAR) / (FAR - NEAR);
            lb.visible = op > 0.03;
            lb.material.opacity = op;
          }
        }
        loopRaf = requestAnimationFrame(loop);
      };
      loop();

      const ro = new ResizeObserver(() => {
        const r = el.getBoundingClientRect();
        Graph.width(r.width); Graph.height(r.height);
      });
      ro.observe(el); el.__ro = ro;
      setTimeout(() => setLoading(false), 400);
    };
    init();
    return () => {
      destroyed = true; cancelAnimationFrame(raf); cancelAnimationFrame(loopRaf);
      const el = mountRef.current; if (el && el.__ro) el.__ro.disconnect();
      const G = graphRef.current; if (G && G._destructor) G._destructor();
    };
  }, []);

  // 섹션이 바뀌면 그래프 데이터를 교체하고 카메라/선택을 초기화한다.
  useEffect(() => {
    const G = graphRef.current; if (!G) return;   // 마운트 시엔 init 이 처리 (graphRef 아직 없음)
    clearSel();
    G.graphData(data);
    G.cameraPosition({ x: 0, y: 0, z: 360 }, { x: 0, y: 0, z: 0 }, 600);
  }, [section]);

  const resetView = () => { clearSel(); const G = graphRef.current; if (G) G.cameraPosition({ x: 0, y: 0, z: 360 }, { x: 0, y: 0, z: 0 }, 750); };

  const sel = selId ? byId[selId] : null;

  return (
    <div className="g-pad g-up" style={{ height: '100%', display: 'flex', flexDirection: 'column', maxWidth: 'none' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            공급망 지도 · 3D · {section === 'all' ? '전체 섹션' : (sections.find((s) => s.key === section)?.label || '')} · 협력사 {supplierCount}개
          </div>
          <h1 className="g-head" style={{ fontSize: 24, margin: 0 }}>누가 누구에게 연결돼 있나요?</h1>
          <p className="tx-2" style={{ fontSize: 13.5, margin: '6px 0 0', maxWidth: 620 }}>
            <b>드래그</b>로 시점을 돌리고(놓으면 고정), <b>스크롤</b>로 확대해요. <b style={{ color: 'var(--brand-tx)' }}>크고 청록색인 구</b>가 대기업, 작은 구가 협력사예요. 가까이 다가가면 <b>기업 이름</b>이 떠오르고, 클릭하면 커지면서 정보가 나와요.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="g-seg">
            <button className={mode === '2d' ? 'on' : ''} onClick={() => setMode('2d')}>2D</button>
            <button className={mode === '3d' ? 'on' : ''} onClick={() => setMode('3d')}>3D</button>
          </div>
          <button className={`a4-chip ${section === 'all' ? 'on' : ''}`} onClick={() => setSection('all')}>전체</button>
          {sections.map((s) => (
            <button key={s.key} className={`a4-chip ${section === s.key ? 'on' : ''}`} onClick={() => setSection(s.key)}>{s.label}</button>
          ))}
          <button className="a4-chip" onClick={resetView} title="카메라 시점 초기화">시점 초기화</button>
        </div>
      </div>

      {/* 3D 캔버스 */}
      <div className="a4-map" style={{ position: 'relative' }}>
        <div ref={mountRef} className="ng-canvas" />

        {loading && (
          <div className="ng-loading"><div className="ng-spin" />3D 공급망 구성 중…</div>
        )}

        {/* 등급 범례 */}
        <div className="a4-legend" style={{ left: 16, top: 16 }}>
          <div className="lg-title">색 = 등급</div>
          {[['POSITIVE', '숨은 진주'], ['NEGATIVE', '거품 경보'], ['MONITOR', '모니터링']].map(([k, l]) => (
            <div className="lg-row" key={k}><span style={{ width: 11, height: 11, borderRadius: '50%', background: NG_NEON[k], boxShadow: `0 0 8px ${NG_NEON[k]}` }} />{l}</div>
          ))}
          <div className="lg-row" style={{ marginTop: 9 }}><span style={{ width: 15, height: 15, borderRadius: '50%', background: NG_NEON.hub, boxShadow: `0 0 8px ${NG_NEON.hub}` }} />대기업 허브 (큰 구)</div>
        </div>

        {/* 선택 기업 정보 패널 */}
        {sel && (
          <div className="ng-info g-up" style={{ borderColor: `${NG_NEON[sel.grade]}66` }}>
            <button className="ng-info-x" onClick={clearSel}><GIcon name="close" size={16} /></button>
            <div className="eyebrow" style={{ color: NG_NEON[sel.grade], marginBottom: 7 }}>{cgById[sel.parent].name} · {sel.tier}차 협력사</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 21, color: '#eaf4fb', marginBottom: 3 }}>{sel.name}</div>
            <div style={{ fontSize: 12.5, color: '#7d96a8', marginBottom: 16 }}>{sel.sector}</div>

            <div className="ng-metrics">
              <div className="ng-metric">
                <span className="ng-mlabel">D-SCORE</span>
                <span className="ng-mval" style={{ color: NG_NEON[sel.grade], textShadow: `0 0 14px ${NG_NEON[sel.grade]}88` }}>{sel.dScore}</span>
              </div>
              <div className="ng-metric">
                <span className="ng-mlabel">공시-행동 괴리</span>
                <span className="ng-mval" style={{ fontSize: 21, color: '#cde0ee' }}>{sel.discrepancy >= 0 ? '+' : ''}{sel.discrepancy}p</span>
              </div>
            </div>

            <p style={{ fontSize: 12.5, lineHeight: 1.7, color: '#9fb4c4', margin: '14px 0 16px' }}>{sel.summary}</p>

            <button className="ng-cta" style={{ background: NG_NEON[sel.grade] }} onClick={() => onSelectCompany(sel.id)}>
              상세 정보 보기 <GIcon name="arrow" size={15} />
            </button>
          </div>
        )}

        <div style={{ position: 'absolute', right: 16, bottom: 13, zIndex: 4, fontSize: 11, color: '#5b7286', fontFamily: 'var(--g-f-mono)' }}>드래그 회전 · 스크롤 줌 · 클릭 상세</div>
      </div>
    </div>
  );
}

/* ---- 2D / 3D 토글 래퍼 ---- */
function A4NetworkView(props) {
  const [mode, setMode] = useState(() => { try { return localStorage.getItem('cashmap.netMode') || '3d'; } catch (e) { return '3d'; } });
  const set = (m) => { setMode(m); try { localStorage.setItem('cashmap.netMode', m); } catch (e) {} };
  return mode === '3d'
    ? <A4Network3D onSelectCompany={props.onSelectCompany} focusCg={props.focusCg} mode={mode} setMode={set} />
    : <A4Network {...props} mode={mode} setMode={set} />;
}

window.A4Network3D = A4Network3D;
window.A4NetworkView = A4NetworkView;
