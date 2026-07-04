/* ============================================================================
 *  GCompanyDash — 대시보드 A (대안 1)
 *  리스트에서 기업을 선택하면, 그 기업 중심으로 재구성되어 표시
 *    [탭1] 지표 · 공시 분석   [탭2] RM 리포트 생성(PDF 리더기 인라인)
 *  ⚠️ 리포트 탭은 '버튼으로 만든다'가 아니라 '열면 이미 있다'(멘토 피드백).
 * ========================================================================== */
function GCompanyDash({ companyId, onBack, onOpenCompany, onOpenNetwork, favs, toggleFav }) {
  const c = window.ADE.byId[companyId];
  const { GIcon, GPill, GDonut, GScoreBar, GSignal, GTrend, Term, gColor, gSoft } = window.G;
  const GFeat = window.GFeat, GStat = window.GStat, DZModal = window.DisclosureModal;
  const RMReport = window.RMReportModal, RMReportInline = window.RMReportInline;
  const [showDz, setShowDz] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [tab, setTab] = useState('analysis');
  useEffect(() => {
    setShowDz(false); setShowReport(false); setTab('analysis');
    window.scrollTo?.(0, 0);
  }, [companyId]);

  if (!c) return null;
  const cg = window.ADE.cgById[c.parent];
  const sec = window.ADE.sectionByCg(c.parent);
  const meta = window.ADE.featureMeta;
  const isFav = favs.includes(c.id);
  const dz = window.ADE.loadDisclosures(c.id);
  const dzCount = dz.length;
  const peers = window.ADE.companiesInSection(sec.key).filter((p) => p.id !== c.id).slice(0, 5);
  const maxSig = Math.max(...window.ADE.conglomerates.map((x) => x.signal));

  const dzSig = { action: { c: 'var(--g-pos)', s: 'var(--g-pos-soft)', l: '행동' }, plan: { c: 'var(--g-mon)', s: 'var(--g-mon-soft)', l: '계획' }, routine: { c: 'var(--tx-3)', s: 'var(--bg-soft)', l: '정기' } };

  return (
    <div className="g-pad g-up">
      {/* ---- 상단 바: 뒤로 + 경로 + 즐겨찾기 ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <button className="g-btn" onClick={onBack}><GIcon name="back" size={17} />리스트로</button>
        <div className="g-crumb">
          <GIcon name={sec.icon} size={15} /><span>{sec.label}</span>
          <GIcon name="chevron" size={13} /><span style={{ color: 'var(--tx)', fontWeight: 600 }}>{c.name}</span>
        </div>
        <div style={{ flex: 1 }} />
        <button className={`g-favbtn lg ${isFav ? 'on' : ''}`} onClick={() => toggleFav(c.id)}>
          <GIcon name={isFav ? 'star-fill' : 'star'} size={17} />{isFav ? '즐겨찾기됨' : '즐겨찾기'}
        </button>
      </div>

      {/* ---- 헤더: 기업명 ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <h1 className="g-head" style={{ fontSize: 28, margin: 0 }}>{c.name}</h1>
        <GPill grade={c.grade} />
        <span className="g-chip" style={{ cursor: 'default', padding: '5px 12px', fontSize: 12 }}>{c.listed ? '상장사' : '비상장'}</span>
      </div>
      <div className="tx-2" style={{ fontSize: 13.5, marginBottom: 22 }}>{c.sector} · {cg.name} <Term k="협력 차수">{c.tier}차 협력사</Term></div>

      {/* ===== Chrome 스타일 탭 ===== */}
      <div className="cd-tabbar" role="tablist">
        <button className={`cd-tab ${tab === 'analysis' ? 'on' : ''}`} role="tab" aria-selected={tab === 'analysis'} onClick={() => setTab('analysis')}>
          <span className="cd-tab-fav"><GIcon name="spark" size={13} /></span>지표 · 공시 분석
        </button>
        <button className={`cd-tab ${tab === 'report' ? 'on' : ''}`} role="tab" aria-selected={tab === 'report'} onClick={() => setTab('report')}>
          <span className="cd-tab-fav"><GIcon name="doc" size={13} /></span>RM 리포트 생성
        </button>
      </div>

      {/* ── 탭 내용 패널 (탭과 이어짐) ── */}
      <div className="cd-panel">
      {/* ───────── 탭 1 · RM 리포트 생성 (PDF 리더기 인라인) ───────── */}
      <div className="cd-reportwrap g-up" style={{ display: tab === 'report' ? 'block' : 'none' }}>
        {RMReportInline && <RMReportInline companyId={companyId} />}
      </div>

      {/* ───────── 탭 2 · 지표 · 공시 분석 ───────── */}
      <div className="g-cdash g-up" style={{ display: tab === 'analysis' ? 'grid' : 'none' }}>
        {/* ===================== 좌측 ===================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* 히어로 */}
          <div className="g-card g-card-pad" style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <GDonut value={c.dScore} grade={c.grade} size={138} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>한눈에 보기</div>
              <div style={{ fontWeight: 700, fontSize: 17, color: gColor(c.grade), marginBottom: 10 }}>
                {c.grade === 'POSITIVE' ? '행동이 말을 앞서는 우량 신호' : c.grade === 'NEGATIVE' ? '말 대비 행동이 부족한 주의 신호' : '방향을 지켜봐야 할 중립 신호'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', background: gSoft(c.grade), borderRadius: 10 }}>
                <GIcon name={c.discrepancy >= 0 ? 'up' : 'down'} size={16} />
                <span className="tx-2" style={{ fontSize: 12.5 }}><Term k="공시-행동 괴리">공시-행동 괴리</Term></span>
                <span className="tnum g-mono" style={{ marginLeft: 'auto', fontWeight: 700, color: gColor(c.grade) }}>{c.discrepancy >= 0 ? '+' : ''}{c.discrepancy}p</span>
              </div>
            </div>
          </div>

          {/* AI 요약 */}
          <div className="g-card g-card-pad">
            <div className="eyebrow" style={{ marginBottom: 9 }}>AI 분석 요약</div>
            <p className="tx-2" style={{ fontSize: 14, lineHeight: 1.75, margin: 0 }}>{c.summary}</p>
          </div>

          {/* 신호 강도 추이 (시계열) */}
          <div className="g-card">
            <div className="g-card-hd"><GIcon name="spark" size={18} /><h3><Term k="신호 강도">신호 강도</Term> 추이</h3>
              <span className="tx-3" style={{ marginLeft: 'auto', fontSize: 11.5 }}>공시 시점별 S</span></div>
            <div className="g-card-pad">
              <GTrend data={window.ADE.signalTrend(c.id)} color={gColor(c.grade)} />
              <p className="tx-3" style={{ fontSize: 11.5, margin: '6px 0 0' }}>대기업 공시에서 이 기업 테마가 언급된 강도의 시간 흐름입니다.</p>
            </div>
          </div>

          {/* 행동 지표 7 */}
          <div className="g-card">
            <div className="g-card-hd"><GIcon name="spark" size={18} /><h3>행동 지표 7가지</h3>
              <span className="tx-3" style={{ marginLeft: 'auto', fontSize: 11.5 }}>막대가 길수록 강한 신호</span></div>
            <div className="g-card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 28px' }}>
              {meta.map((m, i) => <GFeat key={m.key} meta={m} feat={c.features[m.key]} grade={c.grade} delay={i * 45} />)}
            </div>
          </div>

          {/* 공시 타임라인 */}
          <div className="g-card">
            <div className="g-card-hd"><GIcon name="doc" size={18} /><h3>최근 공시</h3>
              <button className="g-btn ghost" style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--brand-tx)' }} onClick={() => setShowDz(true)}>전체 {dzCount}건 보기 →</button></div>
            <div className="g-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 8, paddingBottom: 8 }}>
              {dz.slice(0, 5).map((d) => {
                const sg = dzSig[d.signal];
                return (
                  <button key={d.id} className="g-dzrow" onClick={() => setShowDz(true)}>
                    <span className="g-dzsig" style={{ color: sg.c, background: sg.s }}>{sg.l}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</div>
                      <div className="tx-3" style={{ fontSize: 11.5 }}>{d.category} · {d.submitter}</div>
                    </div>
                    <span className="tx-3 g-mono" style={{ fontSize: 11.5, flex: 'none' }}>{new Date(d.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ===================== 우측 ===================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* 스탯 타일 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <GStat icon="spark" brand label="D-Score" hint="높을수록 우량" value={c.dScore} />
            <GStat icon="doc" brand label="공시 건수" hint="수집·분석 완료" value={dzCount} />
          </div>

          {/* RM 리포트 바로가기 (상세는 'RM 리포트 생성' 탭) */}
          <div className="g-card g-card-pad">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <span className="g-sec-ic"><GIcon name="doc" size={17} /></span>
              <div>
                <div className="eyebrow">AI 영업 리포트</div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>이미 작성되어 있어요</div>
              </div>
            </div>
            <p className="tx-3" style={{ fontSize: 12, lineHeight: 1.6, margin: '0 0 12px' }}>야간 배치로 이 기업의 신호·근거를 종합한 RM 영업 리포트가 준비돼 있습니다.</p>
            <button className="g-btn primary" style={{ width: '100%' }} onClick={() => setTab('report')}>
              <GIcon name="doc" size={16} />리포트 열기
            </button>
          </div>

          {/* 대기업 신호 (섹션 맥락) */}
          <div className="g-card g-card-pad">
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
              <span className="g-sec-ic"><GIcon name={sec.icon} size={17} /></span>
              <div>
                <div className="eyebrow">{sec.label} 섹션 · 발신 대기업</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{cg.name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
              <span className="tx-2" style={{ fontSize: 12.5 }}><Term k="신호 강도">신호 강도</Term></span>
              <span className="tnum g-mono" style={{ fontSize: 13, color: cg.signal === maxSig ? 'var(--brand-tx)' : 'var(--tx-2)' }}>{cg.signal}</span>
            </div>
            <div className="g-scorebar" style={{ height: 8 }}><i style={{ width: cg.signal + '%', background: 'var(--g-brand)' }} /></div>
            <div className="tx-3" style={{ fontSize: 12, marginTop: 9 }}>{cg.theme}</div>
          </div>

          {/* 동종 섹션 기업 */}
          <div className="g-card">
            <div className="g-card-hd"><GIcon name="grid" size={17} /><h3 style={{ fontSize: 14.5 }}>같은 섹션 기업</h3>
              <span className="tx-3" style={{ marginLeft: 'auto', fontSize: 11.5 }}>눌러서 전환</span></div>
            <div>
              {peers.map((p) => (
                <button key={p.id} className="g-peerrow" onClick={() => onOpenCompany(p.id)}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: gColor(p.grade), flex: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div className="tx-3" style={{ fontSize: 11.5 }}>{p.tier}차 · {p.sector}</div>
                  </div>
                  <span className="tnum g-mono" style={{ fontSize: 13, fontWeight: 600, color: gColor(p.grade), flex: 'none' }}>{p.dScore}</span>
                  <GIcon name="chevron" size={15} />
                </button>
              ))}
            </div>
          </div>

          {onOpenNetwork && (
            <button className="g-btn" style={{ width: '100%' }} onClick={() => onOpenNetwork(c.parent, c.id)}>
              <GIcon name="network" size={17} />공급망 지도에서 보기
            </button>
          )}
        </div>
      </div>
      </div>

      {DZModal && <DZModal companyId={companyId} open={showDz} onClose={() => setShowDz(false)} />}
      {RMReport && <RMReport companyId={companyId} open={showReport} onClose={() => setShowReport(false)} />}
    </div>
  );
}

window.GCompanyDash = GCompanyDash;
