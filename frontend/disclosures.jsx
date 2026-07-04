/* ============================================================================
 *  공시(전자공시) 뷰어 — 전체화면 모달
 *  기업 상세에서 "공시 데이터 확인" → 분기보고서·주요사항보고 등 리스트 +
 *  원문 발췌 + ADE가 주목한 키워드. 테마(라이트/다크) 따름.
 *  ⚠️ useState 등은 components.jsx 의 공유 스코프에서 가져옴 (재선언 금지)
 * ========================================================================== */
const DZ_SIG = {
  action:  { label: '행동 신호', c: 'var(--g-pos)', sc: 'var(--g-pos-soft)' },
  plan:    { label: '계획·기대', c: 'var(--g-mon)', sc: 'var(--g-mon-soft)' },
  routine: { label: '정기·안내', c: 'var(--brand-tx)', sc: 'var(--g-brand-soft)' },
};
const dzFmt = (iso) => { const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };

function DisclosureModal({ companyId, open, onClose }) {
  const { GIcon, GPill } = window.G;
  const c = companyId ? window.ADE.byId[companyId] : null;
  const [cat, setCat] = useState('전체');
  const [sel, setSel] = useState(null);

  const all = useMemo(() => (c ? window.ADE.loadDisclosures(c.id) : []), [companyId]);
  // 모달이 열리면 안내 화면 대신 '첫 공시'를 바로 펼쳐 공시 데이터가 즉시 보이게 한다.
  useEffect(() => { setCat('전체'); setSel(all.length ? all[0].id : null); }, [companyId, open]);

  // ── AI 요약 (로컬 LLM, 서버 연동 시) ──
  const [summary, setSummary] = useState(null);   // { loading } | { text } | { error }
  useEffect(() => { setSummary(null); }, [sel]);   // 선택 바뀌면 요약 초기화
  const genSummary = async () => {
    const item = all.find((d) => d.id === sel);
    if (!item) return;
    setSummary({ loading: true });
    try { setSummary({ text: await window.ADE.summarizeDisclosure(item) }); }
    catch (e) { setSummary({ error: e.message || '요약 생성 실패' }); }
  };

  const cats = ['전체', '정기공시', '주요사항보고', '수시공시'];
  const filtered = cat === '전체' ? all : all.filter((d) => d.category === cat);
  const selItem = all.find((d) => d.id === sel);

  return (
    <div className={`dz-scrim ${open ? 'open' : ''}`} onClick={onClose}>
      {c && (
        <div className="dz-modal" onClick={(e) => e.stopPropagation()}>
          {/* 헤더 */}
          <div className="dz-hd">
            <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--g-brand-soft)', color: 'var(--brand-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><GIcon name="doc" size={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <h2 className="g-head" style={{ fontSize: 18, margin: 0 }}>{c.name}</h2>
                <GPill grade={c.grade} />
              </div>
              <div className="tx-3" style={{ fontSize: 12, marginTop: 2 }}>전자공시 시스템(DART) 연동 · 최근 공시 {all.length}건</div>
            </div>
            <button className="g-btn ghost" style={{ padding: 8, color: 'var(--tx-3)' }} onClick={onClose}><GIcon name="close" size={20} /></button>
          </div>

          {/* 필터 */}
          <div className="dz-tb">
            <div className="g-seg">
              {cats.map((k) => {
                const n = k === '전체' ? all.length : all.filter((d) => d.category === k).length;
                return <button key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{k}<span className="c">{n}</span></button>;
              })}
            </div>
            <span className="tx-3" style={{ marginLeft: 'auto', fontSize: 11.5 }}>왼쪽 목록에서 공시를 선택하세요</span>
          </div>

          {/* 본문 2단 */}
          <div className="dz-grid">
            <div className="dz-list">
              {filtered.map((d) => {
                const s = DZ_SIG[d.signal];
                return (
                  <button key={d.id} className={`dz-row ${sel === d.id ? 'on' : ''}`} onClick={() => setSel(d.id)}>
                    <div className="dz-row-top">
                      <span className="dz-cat">{d.category}</span>
                      <span className="dz-date g-mono">{dzFmt(d.date)}</span>
                    </div>
                    <div className="dz-title">{d.title}</div>
                    <span className="dz-sig" style={{ color: s.c, background: s.sc }}>{s.label}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="tx-3" style={{ padding: 20, fontSize: 12.5, textAlign: 'center' }}>해당 분류의 공시가 없습니다.</div>}
            </div>

            <div className="dz-reader">
              {selItem ? (
                <div className="g-up">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span className="dz-sig" style={{ color: DZ_SIG[selItem.signal].c, background: DZ_SIG[selItem.signal].sc }}>{DZ_SIG[selItem.signal].label}</span>
                    <span className="tx-3" style={{ fontSize: 12 }}>{selItem.category} · {dzFmt(selItem.date)}</span>
                  </div>
                  <h3 className="g-head" style={{ fontSize: 20, margin: '0 0 6px', lineHeight: 1.35 }}>{selItem.title}</h3>
                  <div className="tx-3" style={{ fontSize: 12.5, marginBottom: 18 }}>제출인 · {selItem.submitter}</div>

                  <div className="eyebrow" style={{ marginBottom: 8 }}>공시 원문 발췌</div>
                  <div className="dz-doc">{selItem.excerpt}</div>

                  {/* AI 요약 — 서버 로컬 LLM */}
                  <div className="eyebrow" style={{ margin: '20px 0 9px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    AI 요약 <span className="tx-3" style={{ fontWeight: 400, fontSize: 11 }}>로컬 LLM 기반</span>
                  </div>
                  {!summary && (
                    <button className="g-btn ghost" style={{ fontSize: 12.5 }} onClick={genSummary}>
                      <GIcon name="spark" size={15} />이 공시 요약 생성
                    </button>
                  )}
                  {summary && summary.loading && <div className="tx-3" style={{ fontSize: 12.5 }}>요약 생성 중…</div>}
                  {summary && summary.error && <div className="tx-3" style={{ fontSize: 12.5, color: 'var(--g-neg)' }}>⚠ {summary.error}</div>}
                  {summary && summary.text && <div className="dz-doc" style={{ whiteSpace: 'pre-wrap' }}>{summary.text}</div>}

                  <div className="eyebrow" style={{ margin: '20px 0 9px' }}>ADE가 주목한 키워드</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selItem.keywords.map((k) => <span key={k} className="g-chip" style={{ cursor: 'default', fontSize: 12.5 }}>#{k}</span>)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
                    <button className="g-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={(e) => e.preventDefault()}><GIcon name="doc" size={16} />원문 전체 보기 (DART)</button>
                    <span className="tx-3" style={{ fontSize: 11 }}>※ 데모 데이터</span>
                  </div>
                </div>
              ) : (
                <div className="tx-3" style={{ padding: 28, fontSize: 13, textAlign: 'center' }}>
                  표시할 공시가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.DisclosureModal = DisclosureModal;
