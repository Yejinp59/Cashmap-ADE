/* ============================================================================
 *  GHub — 로그인 직후 진입 화면 (좌우 분할)
 *    좌측: RM이 당장 알아야 할 정보 3가지 (오늘의 브리핑)
 *    우측: 섹션 선택(즐겨찾기·반도체·조선업 …) + 해당 섹션 기업 리스트
 *  기업을 선택하면 → 대시보드 A(GCompanyDash)로 진입
 * ========================================================================== */
function GHub({ user, section, setSection, favs, toggleFav, onOpenCompany }) {
  const { companies, conglomerates, counts, sections, byId, cgById } = window.ADE;
  const { GIcon, GPill, GScoreBar, GSignal, Term, gColor, gSoft } = window.G;
  const [grade, setGrade] = useState('ALL');

  const isFav = (id) => favs.includes(id);

  /* ---- 오늘 RM이 당장 알아야 할 정보 3가지 ---- */
  const topPearl  = useMemo(() => companies.filter((c) => c.grade === 'POSITIVE').sort((a, b) => b.dScore - a.dScore)[0], []);
  const topBubble = useMemo(() => companies.filter((c) => c.grade === 'NEGATIVE').sort((a, b) => a.discrepancy - b.discrepancy)[0], []);
  const hotCg     = useMemo(() => [...conglomerates].sort((a, b) => b.signal - a.signal)[0], []);
  const hotSection = sections.find((s) => s.cg === hotCg.id);

  /* ---- 우측 리스트 (현재 섹션) ---- */
  const baseRows = section === 'fav'
    ? favs.map((id) => byId[id]).filter(Boolean)
    : window.ADE.companiesInSection(section);
  const rows = grade === 'ALL' ? baseRows : baseRows.filter((c) => c.grade === grade);

  const gradeTabs = [
    { key: 'ALL', label: '전체' },
    { key: 'POSITIVE', label: '숨은 진주' },
    { key: 'NEGATIVE', label: '거품 경보' },
    { key: 'MONITOR', label: '모니터링' },
  ];

  const curSec = section === 'fav' ? null : sections.find((s) => s.key === section);

  return (
    <div className="g-hub">
      {/* ============ 좌측: 오늘의 브리핑 (3가지) ============ */}
      <aside className="g-hub-left g-up">
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          오늘의 브리핑 · {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
        <h1 className="g-head" style={{ fontSize: 25, margin: '0 0 4px' }}>
          {user?.empId?.split('-')[0] || 'RM'}님, 오늘 꼭 볼 3가지예요
        </h1>
        <p className="tx-3" style={{ fontSize: 13, margin: '0 0 22px' }}>
          카드를 누르면 해당 기업·섹션으로 바로 들어갑니다.
        </p>

        <div className="g-brief-stack" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <GBrief
            n={1} grade="POSITIVE" icon="pearl" tag="선제 영업 1순위"
            title={topPearl.name} metric={`D-Score ${topPearl.dScore}`}
            desc={<span>오늘 가장 강한 <Term k="숨은 진주">숨은 진주</Term>예요. {cgById[topPearl.parent].name} {topPearl.tier}차 · {topPearl.sector}.</span>}
            cta="이 기업 대시보드 열기" onClick={() => onOpenCompany(topPearl.id)} />
          <GBrief
            n={2} grade="NEGATIVE" icon="alert" tag="여신 리스크 점검"
            title={topBubble.name} metric={`괴리 ${topBubble.discrepancy}p`}
            desc={<span>공시 기대 대비 행동이 가장 뒤처진 <Term k="거품 경보">거품 경보</Term>입니다. 한도 재점검 권고.</span>}
            cta="이 기업 대시보드 열기" onClick={() => onOpenCompany(topBubble.id)} />
          <GBrief
            n={3} brand icon="spark" tag="신호 최고 섹션"
            title={`${hotSection.label} 섹션`} metric={`신호 ${hotCg.signal}`}
            desc={<span>{hotCg.name}의 <b style={{ color: 'var(--tx)' }}>{hotCg.theme}</b> 신호가 가장 강합니다. 수혜 협력사를 살펴보세요.</span>}
            cta="이 섹션 리스트 보기" onClick={() => { setSection(hotSection.key); setGrade('ALL'); }} />
        </div>

        <div className="g-hub-mini">
          <GMini label="숨은 진주" value={counts.pearls} grade="POSITIVE" />
          <GMini label="거품 경보" value={counts.bubbles} grade="NEGATIVE" />
          <GMini label="모니터링" value={counts.monitors} grade="MONITOR" />
          <GMini label="오늘 공시" value={counts.filingsToday} grade="BRAND" />
        </div>
      </aside>

      {/* ============ 우측: 섹션 + 기업 리스트 ============ */}
      <section className="g-hub-right">
        <div className="g-hub-rhd">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <GIcon name="grid" size={18} />
            <h2 className="g-head" style={{ fontSize: 17, margin: 0 }}>기업 리스트</h2>
            <span className="tx-3" style={{ fontSize: 12.5 }}>섹션을 골라 기업을 선택하세요</span>
          </div>

          {/* 섹션 선택 */}
          <div className="g-secrow">
            <button className={`g-secpill ${section === 'fav' ? 'on' : ''}`} onClick={() => { setSection('fav'); setGrade('ALL'); }}>
              <GIcon name={favs.length ? 'star-fill' : 'star'} size={15} />
              즐겨찾기
              <span className="c">{favs.length}</span>
            </button>
            {sections.map((s) => (
              <button key={s.key} className={`g-secpill ${section === s.key ? 'on' : ''}`} onClick={() => { setSection(s.key); setGrade('ALL'); }}>
                <GIcon name={s.icon} size={15} />
                {s.label}
                <span className="c">{window.ADE.companiesInSection(s.key).length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="g-hub-list">
          {/* 섹션 헤더 + 등급 필터 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span className="g-sec-ic"><GIcon name={curSec ? curSec.icon : 'star-fill'} size={18} /></span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{curSec ? curSec.label : '즐겨찾기'}</div>
                <div className="tx-3" style={{ fontSize: 12 }}>{curSec ? `${cgById[curSec.cg].name} · ${curSec.sub}` : '내가 담아둔 기업'}</div>
              </div>
            </div>
            <div className="g-seg">
              {gradeTabs.map((t) => <button key={t.key} className={grade === t.key ? 'on' : ''} onClick={() => setGrade(t.key)}>{t.label}</button>)}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="g-empty">
              <span className="g-empty-ic"><GIcon name={section === 'fav' ? 'star' : 'search'} size={26} /></span>
              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 12 }}>
                {section === 'fav' ? '아직 즐겨찾기한 기업이 없어요' : '해당 조건의 기업이 없습니다'}
              </div>
              <div className="tx-3" style={{ fontSize: 13, marginTop: 4 }}>
                {section === 'fav' ? '리스트에서 ★ 별을 눌러 자주 보는 기업을 담아두세요.' : '다른 등급 탭을 선택해보세요.'}
              </div>
            </div>
          ) : (
            <div className="g-card" style={{ overflow: 'hidden' }}>
              <table className="g-tbl">
                <thead><tr>
                  <th>기업</th>
                  <th style={{ width: 190 }}>D-Score</th>
                  <th style={{ width: 116 }}>등급</th>
                  <th style={{ width: 78 }}>신호</th>
                  <th style={{ width: 44 }}></th>
                </tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} onClick={() => onOpenCompany(c.id)}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div className="tx-3" style={{ fontSize: 12 }}>{cgById[c.parent].name} · {c.tier}차 · {c.sector}</div>
                      </td>
                      <td><GScoreBar value={c.dScore} grade={c.grade} /></td>
                      <td><GPill grade={c.grade} /></td>
                      <td><GSignal value={c.signal} /></td>
                      <td>
                        <button className={`g-favbtn ${isFav(c.id) ? 'on' : ''}`} title={isFav(c.id) ? '즐겨찾기 해제' : '즐겨찾기'}
                          onClick={(e) => { e.stopPropagation(); toggleFav(c.id); }}>
                          <GIcon name={isFav(c.id) ? 'star-fill' : 'star'} size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* 브리핑 카드 */
function GBrief({ n, grade, brand, icon, tag, title, metric, desc, cta, onClick }) {
  const { GIcon, gColor, gSoft } = window.G;
  const c = brand ? 'var(--g-brand)' : gColor(grade);
  const soft = brand ? 'var(--g-brand-soft)' : gSoft(grade);
  return (
    <button className="g-brief g-hovercard" onClick={onClick} style={{ '--bc': c }}>
      <span className="g-brief-ic" style={{ background: soft, color: c }}><GIcon name={icon} size={22} /></span>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span className="g-brief-tag" style={{ color: c, background: soft }}>{tag}</span>
          <span className="tx-3 g-mono" style={{ fontSize: 11 }}>0{n}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>{title}</span>
          <span className="g-mono" style={{ fontSize: 12.5, fontWeight: 600, color: c }}>{metric}</span>
        </div>
        <div className="tx-2" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 5 }}>{desc}</div>
        <div className="g-brief-cta" style={{ color: c }}>{cta} <GIcon name="arrow" size={14} /></div>
      </div>
    </button>
  );
}

function GMini({ label, value, grade }) {
  const { useCount } = window.G;
  const n = useCount(value);
  const map = {
    POSITIVE: { c: 'var(--g-pos)', s: 'var(--g-pos-soft)' },
    NEGATIVE: { c: 'var(--g-neg)', s: 'var(--g-neg-soft)' },
    MONITOR:  { c: 'var(--g-mon)', s: 'var(--g-mon-soft)' },
    BRAND:    { c: 'var(--g-brand)', s: 'var(--g-brand-soft)' },
  };
  const m = map[grade] || map.BRAND;
  return (
    <div className="g-mini" style={{ background: m.s, '--mc': m.c }}>
      <div className="g-mini-v tnum g-mono" style={{ color: m.c }}>{n}</div>
      <div className="g-mini-l">{label}</div>
    </div>
  );
}

window.GHub = GHub;
