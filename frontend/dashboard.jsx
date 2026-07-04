/* ============================================================================
 *  3안 대시보드  —  가이드 배너 + 카드형 요약 + 친절한 순위
 * ========================================================================== */
function GDashboard({ onSelectCompany, user }) {
  const { counts, companies, conglomerates, alerts, cgById } = window.ADE;
  const { GIcon, GPill, GScoreBar, GSignal, Term, gColor, useCount, gRel } = window.G;
  const [filter, setFilter] = useState('ALL');
  const [showGuide, setShowGuide] = useState(true);
  const [sort, setSort] = useState({ key: 'dScore', dir: -1 });

  const tabs = [
    { key: 'ALL', label: '전체', cnt: companies.length },
    { key: 'POSITIVE', label: '숨은 진주', cnt: counts.pearls },
    { key: 'NEGATIVE', label: '거품 경보', cnt: counts.bubbles },
    { key: 'MONITOR', label: '모니터링', cnt: counts.monitors },
  ];
  const rows = useMemo(() => {
    let r = companies.filter((c) => filter === 'ALL' || c.grade === filter);
    return [...r].sort((a, b) => { const k = sort.key, av = k === 'name' ? a.name : a[k], bv = k === 'name' ? b.name : b[k]; return av < bv ? -sort.dir : av > bv ? sort.dir : 0; });
  }, [filter, sort]);
  const setK = (k) => setSort((s) => s.key === k ? { key: k, dir: -s.dir } : { key: k, dir: -1 });
  const maxSig = Math.max(...conglomerates.map((c) => c.signal));

  return (
    <div className="g-pad g-up">
      {/* 인사 */}
      <div style={{ marginBottom: 22 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>오늘의 브리핑 · {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</div>
        <h1 className="g-head" style={{ fontSize: 27, margin: 0 }}>{user?.empId?.split('-')[0] || 'RM'}님, 살펴볼 신호를 정리했어요</h1>
      </div>

      {/* 가이드 배너 (초보자 안내) */}
      {showGuide && (
        <div className="g-banner" style={{ marginBottom: 22 }}>
          <span className="b-ic"><GIcon name="info" size={21} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 2 }}>처음이신가요? 이렇게 읽어보세요</div>
            <div className="tx-2" style={{ fontSize: 13.5 }}>
              아래 <Term k="D-Score">D-Score</Term>가 높은 <Term k="숨은 진주">숨은 진주</Term>부터 확인하세요. 기업을 클릭하면 자세한 근거가 열립니다. 밑줄 친 단어에 마우스를 올리면 설명이 나와요.
            </div>
          </div>
          <button className="g-btn ghost" onClick={() => setShowGuide(false)} style={{ flex: 'none', color: 'var(--tx-3)' }}><GIcon name="close" size={18} /></button>
        </div>
      )}

      {/* 요약 카드 4 */}
      <div className="g-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}>
        <GStat icon="pearl" grade="POSITIVE" label="숨은 진주" hint="지금 선제 영업하기 좋은 기업" value={counts.pearls} onClick={() => setFilter('POSITIVE')} />
        <GStat icon="alert" grade="NEGATIVE" label="거품 경보" hint="여신 리스크를 살펴볼 기업" value={counts.bubbles} onClick={() => setFilter('NEGATIVE')} />
        <GStat icon="eye" grade="MONITOR" label="모니터링" hint="추세를 지켜볼 기업" value={counts.monitors} onClick={() => setFilter('MONITOR')} />
        <GStat icon="doc" brand label="오늘 갱신 공시" hint={`${conglomerates.length}개 대기업에서 수집`} value={counts.filingsToday} />
      </div>

      <div className="g-grid-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.75fr) minmax(320px,1fr)', gap: 16, alignItems: 'start' }}>
        {/* 순위 카드 */}
        <div className="g-card">
          <div className="g-card-hd" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <GIcon name="spark" size={18} /><h3>기업 순위</h3>
              <span className="tx-3" style={{ fontSize: 12.5 }}><Term k="D-Score">D-Score</Term> 높은 순</span>
            </div>
            <div className="g-seg">
              {tabs.map((t) => <button key={t.key} className={filter === t.key ? 'on' : ''} onClick={() => setFilter(t.key)}>{t.label}<span className="c">{t.cnt}</span></button>)}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="g-tbl">
              <thead><tr>
                <th onClick={() => setK('name')}>기업</th>
                <th onClick={() => setK('dScore')} style={{ width: 210 }}>D-Score</th>
                <th onClick={() => setK('grade')} style={{ width: 120 }}>등급</th>
                <th onClick={() => setK('signal')} style={{ width: 90 }}>신호</th>
                <th style={{ width: 30 }}></th>
              </tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} onClick={() => onSelectCompany(c.id)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div className="tx-3" style={{ fontSize: 12 }}>{cgById[c.parent].name} · {c.tier}차 · {c.sector}</div>
                    </td>
                    <td><GScoreBar value={c.dScore} grade={c.grade} /></td>
                    <td><GPill grade={c.grade} /></td>
                    <td><GSignal value={c.signal} /></td>
                    <td className="tx-3"><GIcon name="chevron" size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 우측 스택 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="g-card">
            <div className="g-card-hd"><GIcon name="spark" size={18} /><h3>대기업 신호</h3>
              <span className="tx-3" style={{ marginLeft: 'auto', fontSize: 12 }}><Term k="신호 강도">강도</Term></span></div>
            <div className="g-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {conglomerates.map((cg) => (
                <div key={cg.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{cg.name}</span>
                    <span className="tnum g-mono" style={{ fontSize: 13, color: cg.signal === maxSig ? 'var(--brand-tx)' : 'var(--tx-3)' }}>{cg.signal}</span>
                  </div>
                  <div className="g-scorebar" style={{ height: 8 }}>
                    <i style={{ width: cg.signal + '%', background: cg.signal === maxSig ? 'var(--g-brand)' : 'var(--tx-3)' }} />
                  </div>
                  <div className="tx-3" style={{ fontSize: 12, marginTop: 5 }}>{cg.theme}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="g-card">
            <div className="g-card-hd"><GIcon name="alert" size={18} /><h3>살펴볼 알림</h3>
              <span className="g-pill" style={{ marginLeft: 'auto', color: 'var(--g-neg)', background: 'var(--g-neg-soft)' }}><span className="d" style={{ background: 'var(--g-neg)' }} />{alerts.filter(a => a.grade === 'NEGATIVE').length}건</span></div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {alerts.map((a) => (
                <div key={a.id} onClick={() => onSelectCompany(a.id)} style={{ display: 'flex', gap: 12, padding: '14px 22px', borderBottom: '1px solid var(--line-2)', cursor: 'pointer' }} className="g-hoverrow">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: gColor(a.grade), flex: 'none', marginTop: 6 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.name}</span>
                      <span className="tx-3 g-mono" style={{ fontSize: 11.5, flex: 'none' }}>{gRel(a.updatedAt)}</span>
                    </div>
                    <div className="tx-2" style={{ fontSize: 12.5, marginTop: 2 }}>{a.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GStat({ icon, grade, brand, label, hint, value, onClick }) {
  const { GIcon, gColor, gSoft, useCount } = window.G;
  const n = useCount(value);
  const c = brand ? 'var(--g-brand)' : gColor(grade);
  const soft = brand ? 'var(--g-brand-soft)' : gSoft(grade);
  return (
    <div className="g-card g-stat g-card-pad" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span className="ic-wrap" style={{ background: soft, color: c }}><GIcon name={icon} size={22} /></span>
        {onClick && <span className="tx-3" style={{ fontSize: 11.5 }}>모아보기 →</span>}
      </div>
      <div className="v" style={{ color: c }}>{n}</div>
      <div style={{ fontWeight: 600, fontSize: 14.5, marginTop: 8 }}>{label}</div>
      <div className="tx-3" style={{ fontSize: 12.5, marginTop: 2 }}>{hint}</div>
    </div>
  );
}

window.GDashboard = GDashboard;
window.GStat = GStat;
