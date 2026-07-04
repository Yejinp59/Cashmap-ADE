/* ============================================================================
 *  RM 영업 리포트 — PDF 리더기
 *    · RMReportPages  : 종이 페이지(A4) 마크업 (모달/인라인 공용)
 *    · RMReportInline : RM 리포트 생성 탭에 그대로 박히는 인라인 리더기
 *    · RMReportModal  : 전체화면 모달 리더기 (기존)
 *  ⚠️ useState 등은 components.jsx 공유 스코프에서 사용 (재선언 금지)
 * ========================================================================== */
/* 레이더 축 라벨 축약 (긴 라벨이 차트에서 겹치지 않도록) */
const RM_RAD_SHORT = {
  '특허 수': '특허', 'R&D 비중': 'R&D비중', 'R&D 성장률': 'R&D성장',
  '영업이익률 기울기': '이익추세', 'IPC Entropy': 'IPC',
  '발명자 증감률': '발명자', '공시 의지 점수': '공시의지',
};

function rmReportData(c, cg, sec, meta, nar) {
  const topFeats = meta
    .map((m) => ({ label: m.label, ...c.features[m.key] }))
    .sort((a, b) => b.norm - a.norm).slice(0, 4);
  // 레이더: 7개 지표 고정 순서 (면적=0~100 norm, 라벨=실측치)
  const radar = meta.map((m) => {
    const fx = c.features[m.key] || {};
    return {
      label: RM_RAD_SHORT[m.label] || m.label,
      norm: fx.norm || 0,
      raw: fx.raw,
      unit: m.unit || '',
    };
  });
  // 동종기업(같은 대기업 공급망) D-Score 순위 — 현재 기업 중심 6개 창
  const all = window.ADE.companies || [];
  const peersAll = all.filter((x) => x.parent === c.parent).sort((a, b) => b.dScore - a.dScore);
  const rank = peersAll.findIndex((x) => x.id === c.id) + 1;
  const start = Math.max(0, Math.min(rank - 3, peersAll.length - 6));
  const peers = peersAll.slice(start, start + 6).map((p) => ({
    id: p.id, name: p.name, tier: p.tier, dScore: p.dScore, grade: p.grade,
    rank: peersAll.findIndex((x) => x.id === p.id) + 1, me: p.id === c.id,
  }));
  return {
    generatedAt: nar.generatedAt,
    headline: nar.headline,
    diagnosis: nar.diagnosis,
    action: nar.action,
    basis: nar.basis,
    risk: nar.risk,
    model: nar.model,
    source: nar.source,
    topFeats, radar, peers, peerRank: rank, peerTotal: peersAll.length,
  };
}

/* 서사 비동기 로더 훅 — 즉시 룰베이스(narrativeFor)로 채우고, 백엔드 EXAONE 결과가
 * 오면 교체한다. '열면 이미 있다'(placeholder 즉시) + '진짜 AI 생성'(swap) 둘 다 만족. */
function useNarrative(companyId) {
  const [nar, setNar] = useState(() => companyId ? window.ADE.narrativeFor(companyId) : null);
  const [busy, setBusy] = useState(false);
  const load = (regenerate) => {
    if (!companyId) return;
    setBusy(true);
    Promise.resolve(window.ADE.buildNarrative(companyId, { regenerate }))
      .then((n) => { if (n) setNar(n); })
      .finally(() => setBusy(false));
  };
  useEffect(() => {
    if (!companyId) return;
    setNar(window.ADE.narrativeFor(companyId));   // 즉시 표시
    load(false);                                   // 백엔드 EXAONE 로 교체
  }, [companyId]);
  return { nar, busy, reanalyze: () => load(true) };
}

/* ── 리포트용 시각화 프리미티브 (흰 종이·인쇄 대응, 등급색 사용) ───────── */
function RMScoreDonut({ value, color, label }) {
  const size = 112, r = size / 2 - 9, cx = size / 2, circ = 2 * Math.PI * r;
  return (
    <div className="rm-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#eef2f6" strokeWidth="9" />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${(value / 100) * circ} ${circ}`} transform={`rotate(-90 ${cx} ${cx})`} />
      </svg>
      <div className="rm-donut-c"><b style={{ color }}>{value}</b><span>{label}</span></div>
    </div>
  );
}

function RMRadar({ feats, color, size = 224 }) {
  const n = feats.length;
  const cx = size / 2, cy = size / 2, R = size / 2 - 32;
  const ang = (i) => (-90 + (i * 360) / n) * Math.PI / 180;
  const pt = (i, rad) => [cx + Math.cos(ang(i)) * rad, cy + Math.sin(ang(i)) * rad];
  const ptsAt = (t) => feats.map((_, i) => pt(i, R * t)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const poly = feats.map((f, i) => pt(i, R * Math.max(0.03, (f.norm || 0) / 100)))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg width={size} height={size} style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}>
      {[0.25, 0.5, 0.75, 1].map((t, k) => <polygon key={k} points={ptsAt(t)} fill="none" stroke="#e3e9ef" strokeWidth="1" />)}
      {feats.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e3e9ef" strokeWidth="1" />; })}
      <polygon points={poly} fill={color} fillOpacity="0.16" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {feats.map((f, i) => { const [x, y] = pt(i, R * Math.max(0.03, (f.norm || 0) / 100)); return <circle key={i} cx={x} cy={y} r="2.6" fill={color} />; })}
      {feats.map((f, i) => {
        const [lx, ly] = pt(i, R + 16); const co = Math.cos(ang(i));
        const anchor = Math.abs(co) < 0.35 ? 'middle' : co > 0 ? 'start' : 'end';
        const val = (f.raw != null ? `${f.raw}${f.unit || ''}` : '');
        return (
          <text key={i} x={lx} y={ly + 3} textAnchor={anchor}>
            <tspan style={{ fontSize: 9, fill: '#8a94a0' }}>{f.label} </tspan>
            <tspan style={{ fontSize: 10, fontWeight: 700, fill: '#0d1620', fontFamily: 'var(--g-f-mono)' }}>{val}</tspan>
          </text>
        );
      })}
    </svg>
  );
}

function RMDivBar({ value, range = 25 }) {
  const v = Math.max(-range, Math.min(range, value));
  const pos = v >= 0, col = pos ? 'var(--g-pos)' : 'var(--g-neg)';
  const w = (Math.abs(v) / range) * 50;   // 중앙 기준 반폭(%)
  return (
    <div className="rm-divbar">
      <div className="rm-divbar-track">
        <span className="rm-divbar-mid" />
        <span className="rm-divbar-fill" style={{ background: col, width: w + '%', left: pos ? '50%' : (50 - w) + '%' }} />
      </div>
      <div className="rm-divbar-ends"><span>− 거품</span><span>우량 +</span></div>
    </div>
  );
}

function RMPeerChart({ peers }) {
  const { gColor } = window.G;
  return (
    <div className="rm-peerchart">
      {peers.map((p) => {
        const col = gColor(p.grade);
        return (
          <div className={`rm-pcrow ${p.me ? 'me' : ''}`} key={p.id}>
            <span className="rk g-mono">{p.rank}</span>
            <span className="nm">{p.name}{p.me ? ' · 현재' : ''}</span>
            <span className="track"><i style={{ width: p.dScore + '%', background: col }} /></span>
            <b className="v g-mono" style={{ color: col }}>{p.dScore}</b>
          </div>
        );
      })}
    </div>
  );
}

/* ── 종이 페이지 (공용) ─────────────────────────────────────────────── */
function RMReportPages({ c, cg, sec, r, gc, gradeLabel, dateStr, total, activePage, continuous, memo }) {
  const { GIcon } = window.G;
  const cls = (n) => (continuous || activePage === n) ? 'show' : 'hide';
  return (
    <React.Fragment>
      {/* ───────── PAGE 1 ───────── */}
      <article className={`rm-page ${cls(1)}`} data-page="1">
        <div className="rm-doc-hd">
          <div>
            <div className="rm-brand">하나금융 · CashMap</div>
            <h1 className="rm-doc-title">RM 영업 리포트</h1>
          </div>
          <div className="rm-doc-meta">
            <div><span>발행일</span>{dateStr}</div>
            <div><span>분류</span>대외비 · 내부 검토용</div>
            <div><span>작성</span>ADE 자동 분석</div>
          </div>
        </div>

        <div className="rm-co">
          <div>
            <div className="rm-co-name">{c.name}</div>
            <div className="rm-co-sub">{c.sector} · {cg.name} {c.tier}차 협력사 · {c.listed ? '상장사' : '비상장'}</div>
          </div>
          <RMScoreDonut value={c.dScore} color={gc} label={gradeLabel} />
        </div>

        {/* 핵심 지표 한눈에 — 레이더 + 게이지형 요약 (FnGuide식 시각 대시보드) */}
        <section className="rm-sec">
          <h2 className="rm-h2"><span><GIcon name="grid" size={13} /></span>핵심 지표 한눈에</h2>
          <div className="rm-viz">
            <div className="rm-viz-radar">
              <RMRadar feats={r.radar} color={gc} />
              <div className="rm-viz-cap">행동 지표 7종 · 축=실측치, 면적=상대강도(0~100, 넓을수록 강함)</div>
            </div>
            <div className="rm-viz-side">
              <div className="rm-viz-metric">
                <div className="lab"><span>공시-행동 괴리</span><b style={{ color: gc }}>{c.discrepancy >= 0 ? '+' : ''}{c.discrepancy}p</b></div>
                <RMDivBar value={c.discrepancy} />
              </div>
              <div className="rm-viz-metric">
                <div className="lab"><span>섹션 신호 강도</span><b>{cg.signal} / 100</b></div>
                <div className="rm-minibar"><i style={{ width: cg.signal + '%', background: '#0a8a8a' }} /></div>
              </div>
              <div className="rm-viz-tiles">
                <div><span>소속 섹션</span><b>{sec.label}</b></div>
                <div><span>공급망 순위</span><b style={{ color: gc }}>{r.peerRank}위 / {r.peerTotal}</b></div>
              </div>
            </div>
          </div>
        </section>

        <section className="rm-sec">
          <h2 className="rm-h2"><span>01</span>결론</h2>
          <p className="rm-p" style={{ fontWeight: 600, color: '#0d1620' }}>{r.headline}</p>
        </section>

        <section className="rm-sec">
          <h2 className="rm-h2"><span>02</span>핵심 진단</h2>
          <p className="rm-p">{r.diagnosis}</p>
        </section>

        <div className="rm-foot"><span>CashMap RM Report</span><span>1 / {total}</span></div>
      </article>

      {/* ───────── PAGE 2 ───────── */}
      <article className={`rm-page ${cls(2)}`} data-page="2">
        <div className="rm-doc-hd slim">
          <div className="rm-brand">하나금융 · CashMap — {c.name}</div>
          <div className="rm-doc-meta-inline">{dateStr}</div>
        </div>

        <section className="rm-sec">
          <h2 className="rm-h2"><span>03</span>추천 액션</h2>
          <div className="rm-action" style={{ borderColor: gc, background: `color-mix(in srgb, ${gc} 7%, transparent)` }}>
            <span className="rm-action-ic" style={{ background: gc }}><GIcon name="spark" size={16} /></span>
            <p className="rm-p" style={{ margin: 0 }}>{r.action}</p>
          </div>
        </section>

        <section className="rm-sec">
          <h2 className="rm-h2"><span>04</span>근거</h2>
          <p className="rm-p">{r.basis}</p>
        </section>

        <section className="rm-sec">
          <h2 className="rm-h2"><span>05</span>{cg.name} 공급망 내 D-Score 비교</h2>
          <RMPeerChart peers={r.peers} />
          <div className="rm-pc-cap">동일 대기업({cg.name}) 협력사 {r.peerTotal}곳 중 상위 구간 · <b style={{ color: gc }}>{c.name} {r.peerRank}위</b></div>
        </section>

        <section className="rm-sec">
          <h2 className="rm-h2"><span>06</span>리스크·주의</h2>
          <p className="rm-p">{r.risk}</p>
        </section>

        <section className="rm-sec">
          <h2 className="rm-h2"><span>07</span>RM 메모</h2>
          {memo && memo.trim()
            ? <p className="rm-p rm-memo-text">{memo}</p>
            : <div className="rm-memo-lines"><span></span><span></span></div>}
        </section>

        <div className="rm-sign">
          <div><span>담당 RM</span><div className="rm-sign-line"></div></div>
          <div><span>심사 검토</span><div className="rm-sign-line"></div></div>
        </div>
        <div className="rm-foot"><span>본 리포트는 ADE 분석 기반 참고자료이며 여신 결정의 단독 근거가 아닙니다.</span><span>2 / {total}</span></div>
      </article>
    </React.Fragment>
  );
}

/* ── 우측 정보 패널 (인라인 리더기 전용) ──────────────────────────────
 * A4 문서 옆 빈 공간을 RM 실무에 쓸모 있는 정보로 채운다.
 *  · AI 리포트 정보(생성 엔진/시각) · 핵심 스냅샷 · 같은 공급망 동종기업 비교 · 문서 목차 */
function RMReportSide({ c, cg, sec, r, gc, gradeLabel, busy, memo, onMemo }) {
  const { GIcon, gColor } = window.G;
  const all = window.ADE.companies || [];
  const peers = all.filter((x) => x.parent === c.parent).sort((a, b) => b.dScore - a.dScore);
  const rankOf = (id) => peers.findIndex((x) => x.id === id) + 1;
  const rank = rankOf(c.id), total = peers.length;
  const start = Math.max(0, Math.min(rank - 3, total - 6));   // 현재 기업이 보이도록 6개 창
  const view = peers.slice(start, start + 6);
  const modelReal = r.model && r.model !== 'fallback';
  const toc = [['01', '결론'], ['02', '핵심 진단'], ['03', '추천 액션'], ['04', '근거'], ['05', '공급망 내 비교'], ['06', '리스크·주의'], ['07', 'RM 메모']];

  return (
    <aside className="rm-side">
      {/* AI 리포트 정보 */}
      <div className="rm-side-card">
        <div className="rm-side-hd"><GIcon name="spark" size={14} /><span>AI 리포트 정보</span></div>
        <div className={`rm-ai-badge ${modelReal ? 'live' : 'rule'}`}><span className="dot" />{busy ? 'AI 생성 중…' : r.source}</div>
        <div className="rm-side-kv">
          <div><span>생성 엔진</span><b>{modelReal ? r.model : '룰베이스'}</b></div>
          <div><span>생성 시각</span><b>{r.generatedAt}</b></div>
          <div><span>데이터 기준</span><b>야간 배치 · 매일 02:00</b></div>
        </div>
        <p className="rm-side-note">공시·특허·R&D 신호를 종합해 <b>사전 생성</b>된 제언입니다. 여신 결정의 단독 근거가 아닙니다.</p>
      </div>

      {/* 핵심 스냅샷 */}
      <div className="rm-side-card">
        <div className="rm-side-hd"><GIcon name="grid" size={14} /><span>핵심 스냅샷</span></div>
        <div className="rm-snap-main" style={{ '--gc': gc }}>
          <div className="rm-snap-v">{c.dScore}</div>
          <div className="rm-snap-l">D-Score · {gradeLabel}</div>
        </div>
        <div className="rm-snap-grid">
          <div><span>공시-행동 괴리</span><b style={{ color: gc }}>{c.discrepancy >= 0 ? '+' : ''}{c.discrepancy}p</b></div>
          <div><span>섹션 신호강도</span><b>{cg.signal}</b></div>
          <div><span>소속 섹션</span><b>{sec.label}</b></div>
          <div><span>공급망 위치</span><b>{c.tier}차 협력사</b></div>
        </div>
      </div>

      {/* RM 메모 작성 — 문서 07 섹션·PDF 인쇄에 실시간 반영 */}
      {onMemo && (
        <div className="rm-side-card">
          <div className="rm-side-hd"><GIcon name="doc" size={14} /><span>RM 메모 작성</span></div>
          <textarea
            className="rm-memo-input"
            value={memo || ''}
            rows={5}
            placeholder="접촉 계획·특이사항·내부 코멘트를 적어두세요. 문서의 07 RM 메모 칸과 PDF 인쇄에 그대로 들어갑니다."
            onChange={(e) => onMemo(e.target.value)}
          />
          <p className="rm-side-note">기업별로 이 브라우저에 자동 저장됩니다.</p>
        </div>
      )}

      {/* 같은 공급망 동종기업 */}
      <div className="rm-side-card">
        <div className="rm-side-hd"><GIcon name="network" size={14} /><span>{cg.name} 공급망 내 비교</span></div>
        <div className="rm-rank-line">D-Score 순위 <b style={{ color: gc }}>{rank}위</b> <span>/ {total}개사</span></div>
        <div className="rm-peers">
          {view.map((p) => {
            const pc = gColor(p.grade), me = p.id === c.id;
            return (
              <div className={`rm-peer ${me ? 'me' : ''}`} key={p.id}>
                <span className="rm-peer-rk g-mono">{rankOf(p.id)}</span>
                <span className="rm-peer-nm">{p.name}{me && <em> · 현재</em>}</span>
                <span className="rm-peer-tr">{p.tier}차</span>
                <span className="rm-peer-bar"><i style={{ width: p.dScore + '%', background: pc }} /></span>
                <b className="rm-peer-v g-mono" style={{ color: pc }}>{p.dScore}</b>
              </div>
            );
          })}
        </div>
      </div>

      {/* 문서 목차 */}
      <div className="rm-side-card">
        <div className="rm-side-hd"><GIcon name="doc" size={14} /><span>문서 목차</span></div>
        <div className="rm-toc">
          {toc.map(([n, t]) => <div className="rm-toc-i" key={n}><span className="g-mono">{n}</span>{t}</div>)}
        </div>
      </div>
    </aside>
  );
}

/* ── 인라인 리더기 (RM 리포트 생성 탭에 그대로 노출) ───────────────── */
function RMReportInline({ companyId }) {
  const { GIcon, gColor } = window.G;
  const c = companyId ? window.ADE.byId[companyId] : null;
  const cg = c ? window.ADE.cgById[c.parent] : null;
  const sec = c ? window.ADE.sectionByCg(c.parent) : null;
  const meta = window.ADE.featureMeta;
  const [zoom, setZoom] = useState(1);
  const { nar, busy, reanalyze } = useNarrative(companyId);

  // RM 메모 — 기업별 localStorage 저장, 문서 07 섹션·PDF 인쇄에 즉시 반영
  const [memo, setMemo] = useState('');
  useEffect(() => {
    setZoom(1);
    try { setMemo(localStorage.getItem('cashmap.rmmemo.' + companyId) || ''); } catch (e) { setMemo(''); }
  }, [companyId]);
  const saveMemo = (v) => {
    setMemo(v);
    try { localStorage.setItem('cashmap.rmmemo.' + companyId, v); } catch (e) {}
  };

  if (!c || !nar) return null;
  const TOTAL = 2;
  const r = rmReportData(c, cg, sec, meta, nar);
  const gc = gColor(c.grade);
  const gradeLabel = c.grade === 'POSITIVE' ? '숨은 진주' : c.grade === 'NEGATIVE' ? '거품 경보' : '모니터링';

  const download = () => {
    document.body.classList.add('rm-printing', 'rm-printing-inline');
    window.print();
    setTimeout(() => document.body.classList.remove('rm-printing', 'rm-printing-inline'), 500);
  };

  return (
    <div className="rm-inline rm-print-root">
      {/* ── 상단 액션 바 ── */}
      <div className="rm-toolbar rm-toolbar-inline">
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <span className="rm-fileic"><GIcon name="doc" size={17} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="rm-fname">RM영업리포트_{c.name}.pdf</div>
            <div className="rm-fmeta">CashMap · {busy ? 'AI 생성 중…' : r.source} · {r.generatedAt}</div>
          </div>
        </div>
        <div className="rm-tb-right">
          <div className="rm-zoom">
            <button onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}>−</button>
            <span className="g-mono">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}>+</button>
          </div>
          <button className="g-btn primary rm-dl" onClick={download}><GIcon name="download" size={16} />PDF 다운로드</button>
          <button className="g-btn ghost rm-reanalyze" onClick={reanalyze} disabled={busy}>
            <GIcon name="spark" size={15} />{busy ? '분석 중…' : '다시 분석'}
          </button>
        </div>
      </div>

      {/* ── 페이지 스테이지 (연속 스크롤) + 우측 정보 패널 ── */}
      <div className={`rm-stage rm-stage-inline ${busy ? 'busy' : ''}`}>
        <div className="rm-body">
          <div className="rm-pages" style={{ '--z': zoom }}>
            <RMReportPages c={c} cg={cg} sec={sec} r={r} gc={gc} gradeLabel={gradeLabel} dateStr={r.generatedAt} total={TOTAL} continuous memo={memo} />
          </div>
          <RMReportSide c={c} cg={cg} sec={sec} r={r} gc={gc} gradeLabel={gradeLabel} busy={busy} memo={memo} onMemo={saveMemo} />
        </div>
      </div>
    </div>
  );
}

/* ── 전체화면 모달 리더기 (기존) ─────────────────────────────────────── */
function RMReportModal({ companyId, open, onClose }) {
  const { GIcon, gColor } = window.G;
  const c = companyId ? window.ADE.byId[companyId] : null;
  const cg = c ? window.ADE.cgById[c.parent] : null;
  const sec = c ? window.ADE.sectionByCg(c.parent) : null;
  const meta = window.ADE.featureMeta;
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const { nar, busy } = useNarrative(companyId);
  const TOTAL = 2;

  useEffect(() => { setPage(1); setZoom(1); }, [companyId, open]);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') setPage((p) => Math.min(TOTAL, p + 1)); if (e.key === 'ArrowLeft') setPage((p) => Math.max(1, p - 1)); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  if (!c || !nar) return null;
  const r = rmReportData(c, cg, sec, meta, nar);
  const gc = gColor(c.grade);
  const gradeLabel = c.grade === 'POSITIVE' ? '숨은 진주' : c.grade === 'NEGATIVE' ? '거품 경보' : '모니터링';
  const dateStr = r.generatedAt;

  const download = () => {
    document.body.classList.add('rm-printing');
    window.print();
    setTimeout(() => document.body.classList.remove('rm-printing'), 500);
  };

  return (
    <div className={`rm-scrim rm-print-root ${open ? 'open' : ''}`} onClick={onClose}>
      <div className="rm-reader" onClick={(e) => e.stopPropagation()}>
        {/* 리더기 툴바 */}
        <div className="rm-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <span className="rm-fileic"><GIcon name="doc" size={17} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="rm-fname">RM영업리포트_{c.name}.pdf</div>
              <div className="rm-fmeta">CashMap · {busy ? 'AI 생성 중…' : r.source} · {r.generatedAt}</div>
            </div>
          </div>
          <div className="rm-tb-right">
            <div className="rm-pager">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><GIcon name="chevron" size={15} style={{ transform: 'rotate(180deg)' }} /></button>
              <span className="g-mono">{page} / {TOTAL}</span>
              <button onClick={() => setPage((p) => Math.min(TOTAL, p + 1))} disabled={page === TOTAL}><GIcon name="chevron" size={15} /></button>
            </div>
            <div className="rm-zoom">
              <button onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}>−</button>
              <span className="g-mono">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}>+</button>
            </div>
            <button className="g-btn primary rm-dl" onClick={download}><GIcon name="download" size={16} />PDF 다운로드</button>
            <button className="rm-x" onClick={onClose}><GIcon name="close" size={19} /></button>
          </div>
        </div>

        {/* 페이지 스테이지 */}
        <div className="rm-stage">
          <div className="rm-pages" style={{ '--z': zoom }}>
            <RMReportPages c={c} cg={cg} sec={sec} r={r} gc={gc} gradeLabel={gradeLabel} dateStr={dateStr} total={TOTAL} activePage={page}
              memo={(() => { try { return localStorage.getItem('cashmap.rmmemo.' + c.id) || ''; } catch (e) { return ''; } })()} />
          </div>
        </div>
      </div>
    </div>
  );
}

window.RMReportInline = RMReportInline;
window.RMReportModal = RMReportModal;
