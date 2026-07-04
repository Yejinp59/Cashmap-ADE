/* ============================================================================
 *  3안 기업 상세  —  슬라이드 패널, 친절한 설명 + 도넛 + 피처 카드
 * ========================================================================== */
function GDetail({ companyId, onClose, onOpenNetwork, onOpenCompany }) {
  const { GIcon, GPill, GDonut, GTrend, Term, gColor, gSoft } = window.G;
  const c = companyId ? window.ADE.byId[companyId] : null;
  const open = !!companyId;
  const [showDz, setShowDz] = useState(false);
  const DZModal = window.DisclosureModal;
  useEffect(() => { setShowDz(false); }, [companyId]);

  const cg = c ? window.ADE.cgById[c.parent] : null;
  const meta = window.ADE.featureMeta;

  return (
    <React.Fragment>
      <div className={`g-scrim ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`g-slide ${open ? 'open' : ''}`}>
        {c && (
          <React.Fragment>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <GPill grade={c.grade} />
                  <span className="g-chip" style={{ cursor: 'default', padding: '4px 11px', fontSize: 12 }}>{c.listed ? '상장사' : '비상장'}</span>
                </div>
                <h2 className="g-head" style={{ fontSize: 23, margin: 0 }}>{c.name}</h2>
                <div className="tx-2" style={{ fontSize: 13, marginTop: 4 }}>{c.sector} · {cg.name} <Term k="협력 차수">{c.tier}차 협력사</Term></div>
              </div>
              <button className="g-btn ghost" style={{ padding: 8, color: 'var(--tx-3)' }} onClick={onClose}><GIcon name="close" size={20} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* 도넛 + 한줄 평가 */}
              <div style={{ padding: '24px', display: 'flex', gap: 22, alignItems: 'center', borderBottom: '1px solid var(--line-2)' }}>
                <GDonut value={c.dScore} grade={c.grade} size={132} />
                <div style={{ flex: 1 }}>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>한눈에 보기</div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: gColor(c.grade), marginBottom: 8 }}>
                    {c.grade === 'POSITIVE' ? '행동이 말을 앞서는 우량 신호' : c.grade === 'NEGATIVE' ? '말 대비 행동이 부족한 주의 신호' : '방향을 지켜봐야 할 중립 신호'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: gSoft(c.grade), borderRadius: 10 }}>
                    <GIcon name={c.discrepancy >= 0 ? 'up' : 'down'} size={16} />
                    <span className="tx-2" style={{ fontSize: 12.5 }}><Term k="공시-행동 괴리">공시-행동 괴리</Term></span>
                    <span className="tnum g-mono" style={{ marginLeft: 'auto', fontWeight: 700, color: gColor(c.grade) }}>{c.discrepancy >= 0 ? '+' : ''}{c.discrepancy}p</span>
                  </div>
                </div>
              </div>

              {/* 요약 */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--line-2)' }}>
                <div className="eyebrow" style={{ marginBottom: 8 }}>AI 분석 요약</div>
                <p className="tx-2" style={{ fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>{c.summary}</p>
              </div>

              {/* 신호 강도 추이 (시계열) */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--line-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div className="eyebrow"><Term k="신호 강도">신호 강도</Term> 추이</div>
                  <span className="tx-3" style={{ fontSize: 11.5 }}>공시 시점별 S</span>
                </div>
                <GTrend data={window.ADE.signalTrend(c.id)} color={gColor(c.grade)} h={112} />
              </div>

              {/* 공시 데이터 확인 */}
              <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line-2)' }}>
                <button className="g-btn" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setShowDz(true)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><GIcon name="doc" size={17} />공시 데이터 확인</span>
                  <span className="g-mono tx-3" style={{ fontSize: 12.5 }}>{window.ADE.disclosureCount(c.id)}건 →</span>
                </button>
              </div>

              {/* 피처 카드 */}
              <div style={{ padding: '18px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div className="eyebrow">행동 지표 7가지</div>
                  <span className="tx-3" style={{ fontSize: 11.5 }}>막대가 길수록 강한 신호</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {meta.map((m, i) => <GFeat key={m.key} meta={m} feat={c.features[m.key]} grade={c.grade} delay={i * 55} />)}
                </div>
              </div>

            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line-2)', display: 'flex', gap: 10 }}>
              <button className="g-btn primary" style={{ flex: 1 }} onClick={() => onOpenCompany && onOpenCompany(c.id)}>
                <GIcon name="home" size={17} />기업 대시보드 열기
              </button>
              {onOpenNetwork && <button className="g-btn" onClick={() => onOpenNetwork(c.parent, c.id)} title="공급망에서 보기"><GIcon name="network" size={17} /></button>}
            </div>
          </React.Fragment>
        )}
      </aside>
      {DZModal && <DZModal companyId={companyId} open={showDz} onClose={() => setShowDz(false)} />}
    </React.Fragment>
  );
}

function GFeat({ meta, feat, grade, delay }) {
  const { gColor } = window.G;
  const c = gColor(grade);
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(feat.norm), 60 + delay); return () => clearTimeout(t); }, [feat.norm, delay]);
  const raw = meta.unit === '%' ? `${feat.raw}%` : meta.unit === '건' ? `${feat.raw}건` : `${feat.raw}`;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{meta.label}</span>
        <span className="tnum g-mono tx-2" style={{ fontSize: 12.5 }}>{raw}</span>
      </div>
      <div className="g-scorebar" style={{ height: 8 }}>
        <i style={{ width: w + '%', background: c, transition: 'width .8s var(--g-ease)' }} />
      </div>
      <div className="tx-3" style={{ fontSize: 11.5, marginTop: 4 }}>{meta.desc}</div>
    </div>
  );
}

window.GDetail = GDetail;
window.GFeat = GFeat;
