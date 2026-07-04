/* ============================================================================
 *  대시보드 · 대안 2 — 상황판 (중앙 구체 + 모서리 4코너)
 *  중앙: 핵심 지표 구체. 네 모서리: 나머지 지표 카드. 하단: 대기업 신호.
 *  항상 다크 네이비 + 하나 그린. ⚠️ 훅은 공유 스코프(components.jsx)에서 사용.
 * ========================================================================== */
function GDashboardBoard({ onSelectCompany, user }) {
  const { companies, counts, conglomerates, cgById } = window.ADE;
  const { GIcon, gColor } = window.G;

  const total = companies.length;
  const ranked = useMemo(() => [...companies].sort((a, b) => b.dScore - a.dScore), []);
  const topPearl = ranked.find((c) => c.grade === 'POSITIVE') || ranked[0];
  const pick = (grade) => ranked.filter((c) => c.grade === grade).slice(0, 3);
  const maxSig = Math.max(...conglomerates.map((c) => c.signal));

  return (
    <div className="sb-root">
      {/* ── 모서리: 좌상 — 거품 경보 ── */}
      <SbCorner area="tl" pos="tl" color="var(--g-neg)" icon="alert" label="거품 경보" sub="여신 리스크 점검"
        value={counts.bubbles} chips={pick('NEGATIVE')} onSelectCompany={onSelectCompany} />

      {/* ── 모서리: 우상 — 모니터링 ── */}
      <SbCorner area="tr" pos="tr" color="var(--g-mon)" icon="eye" label="모니터링" sub="추세 관찰 대상"
        value={counts.monitors} chips={pick('MONITOR')} onSelectCompany={onSelectCompany} />

      {/* ── 모서리: 좌하 — 오늘 갱신 공시 ── */}
      <SbCorner area="bl" pos="bl" color="var(--sb-green)" icon="doc" label="오늘 갱신 공시" sub={`${conglomerates.length}개 대기업에서 수집`}
        value={counts.filingsToday} spark onSelectCompany={onSelectCompany} />

      {/* ── 모서리: 우하 — 추적 협력사 ── */}
      <SbCorner area="br" pos="br" color="var(--sb-cyan)" icon="network" label="추적 협력사" sub="전체 분석 대상"
        value={total} compo={counts} onSelectCompany={onSelectCompany} />

      {/* ── 중앙: 핵심 구체 ── */}
      <div className="sb-center" style={{ gridArea: 'center' }}>
        <SbSphere pearls={counts.pearls} total={total} counts={counts} />
        <button className="sb-prio" onClick={() => onSelectCompany(topPearl.id)}>
          <span className="sb-prio-tag">오늘의 1순위</span>
          <span className="sb-prio-name">{topPearl.name}</span>
          <span className="sb-prio-score" style={{ color: gColor(topPearl.grade) }}>D {topPearl.dScore}</span>
          <GIcon name="chevron" size={16} />
        </button>
      </div>

      {/* ── 하단: 대기업 신호 ── */}
      <div className="sb-bottom" style={{ gridArea: 'bottom' }}>
        <div className="sb-bottom-lab"><GIcon name="spark" size={14} />대기업 신호 강도</div>
        <div className="sb-sig-row">
          {conglomerates.map((cg) => (
            <div key={cg.id} className="sb-sig">
              <div className="sb-sig-top">
                <span className="sb-sig-name">{cg.name}</span>
                <span className="sb-sig-val" style={{ color: cg.signal === maxSig ? 'var(--sb-green)' : 'var(--sb-tx2)' }}>{cg.signal}</span>
              </div>
              <span className="sb-sig-bar"><i style={{ width: cg.signal + '%', background: cg.signal === maxSig ? 'var(--sb-green)' : 'var(--sb-tx3)', boxShadow: cg.signal === maxSig ? '0 0 7px var(--sb-green)' : 'none' }} /></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 중앙 구체 ── */
function SbSphere({ pearls, total, counts }) {
  const n = window.G.useCount(pearls, 850);
  const segs = [
    { v: counts.pearls, c: 'var(--g-pos)' },
    { v: counts.monitors, c: 'var(--g-mon)' },
    { v: counts.bubbles, c: 'var(--g-neg)' },
  ];
  const R = 116, C = 2 * Math.PI * R; let acc = 0;
  return (
    <div className="sb-sphere-wrap">
      <svg className="sb-ring" viewBox="0 0 280 280">
        <circle className="sb-spin" cx="140" cy="140" r="132" fill="none" stroke="rgba(0,209,138,.3)" strokeWidth="1" strokeDasharray="2 9" />
        <circle className="sb-spin-rev" cx="140" cy="140" r="124" fill="none" stroke="rgba(120,180,210,.18)" strokeWidth="1" strokeDasharray="16 12" />
        {/* 구성 비율 외곽 호 */}
        {segs.map((s, i) => {
          const len = (s.v / total) * C;
          const el = <circle key={i} cx="140" cy="140" r={R} fill="none" stroke={s.c} strokeWidth="4" strokeLinecap="butt"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 140 140)"
            style={{ filter: `drop-shadow(0 0 4px ${s.c})` }} />;
          acc += len; return el;
        })}
      </svg>
      <div className="sb-sphere">
        <div className="sb-sphere-hl" />
        <div className="sb-sphere-tx">
          <div className="sb-sphere-eye">지금 영업할</div>
          <div className="sb-sphere-num">{n}<span className="sb-sphere-unit">곳</span></div>
          <div className="sb-sphere-lab">숨은 진주</div>
          <div className="sb-sphere-sub">전체 {total}개 중</div>
        </div>
      </div>
    </div>
  );
}

/* ── 모서리 카드 ── */
function SbCorner({ area, pos, color, icon, label, sub, value, chips, spark, compo, onSelectCompany }) {
  const { GIcon, gColor } = window.G;
  const n = window.G.useCount(value);
  return (
    <div className={`sb-corner sb-${pos}`} style={{ gridArea: area }}>
      <div className="sb-corner-hd">
        <span className="sb-corner-ic" style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}><GIcon name={icon} size={17} /></span>
        <div style={{ minWidth: 0 }}>
          <div className="sb-corner-lab">{label}</div>
          <div className="sb-corner-sub">{sub}</div>
        </div>
        <span className="sb-corner-val" style={{ color }}>{n}</span>
      </div>

      {chips && (
        <div className="sb-chips">
          {chips.map((c) => (
            <button key={c.id} className="sb-chip" onClick={() => onSelectCompany(c.id)}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: gColor(c.grade), flex: 'none' }} />
              <span className="sb-chip-nm">{c.name}</span>
              <span className="sb-chip-sc" style={{ color: gColor(c.grade) }}>{c.dScore}</span>
            </button>
          ))}
        </div>
      )}

      {spark && (
        <div className="sb-spark">
          {[42, 58, 49, 71, 63, 82, 76, 91].map((h, i) => (
            <i key={i} style={{ height: h + '%', background: i === 7 ? color : 'var(--sb-tx3)', opacity: i === 7 ? 1 : .5 }} />
          ))}
          <span className="sb-spark-lab">최근 8일 추이</span>
        </div>
      )}

      {compo && (
        <div className="sb-compo">
          {[['진주', compo.pearls, 'var(--g-pos)'], ['관찰', compo.monitors, 'var(--g-mon)'], ['경보', compo.bubbles, 'var(--g-neg)']].map(([l, v, c]) => (
            <div key={l} className="sb-compo-item"><span style={{ background: c }} /><b>{v}</b>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

window.GDashboardBoard = GDashboardBoard;
