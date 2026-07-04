/* ============================================================================
 *  접촉 파이프라인 — RM 영업 칸반 보드
 *    · RM이 맡은 관리 대상 ~59곳을 단계별 칸반으로 관리
 *    · 카드 드래그로 단계 이동 (미접촉 → 접촉중 → 심사중 → 연결완료)
 *    · 카드 클릭 → 상세 드로어에서 메모 작성 + 단계 변경 + 대시보드 열기
 *    · 단계·메모는 사용자별 localStorage 저장
 * ========================================================================== */
/* 섹션(산업)별 카드 배경 틴트 — 어느 생태계 기업인지 한눈에 구분 */
const PL_SEC_COLORS = {
  semi:  '#0a8a8a',   // 반도체 — 브랜드 틸
  ship:  '#2f6fd1',   // 조선업 — 블루
  ev:    '#7a5ad8',   // 전기차·2차전지 — 바이올렛
  solar: '#d9950a',   // 태양광 — 앰버
  bio:   '#d84a8a',   // 바이오 — 로즈
};
function plSecColor(parentCg) {
  const s = window.ADE.sectionByCg ? window.ADE.sectionByCg(parentCg) : null;
  return (s && PL_SEC_COLORS[s.key]) || 'transparent';
}

function GPipeline({ user, onOpenCompany, favs, toggleFav }) {
  const { GIcon } = window.G;
  const stages = window.ADE.pipelineStages;
  const empId = user?.empId;
  const favSet = new Set(favs || []);   // 대시보드와 동일 저장소 (사용자별 즐겨찾기)

  const [items, setItems] = useState(() => window.ADE.loadPipeline(empId));
  const [openId, setOpenId] = useState(null);
  const [q, setQ] = useState('');
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  useEffect(() => { setItems(window.ADE.loadPipeline(empId)); }, [empId]);

  const patch = (id, p) => {
    window.ADE.savePipelineItem(empId, id, p);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
  };

  const moveTo = (id, stage) => {
    const it = items.find((x) => x.id === id);
    if (!it || it.stage === stage) return;
    const lastContact = stage !== 'lead' && !it.lastContact ? new Date().toISOString() : it.lastContact;
    patch(id, { stage, lastContact });
  };

  // 검색 필터
  const visible = items.filter((it) => {
    if (q && !(it.name.includes(q) || it.sector.includes(q) || it.cgName.includes(q))) return false;
    return true;
  });
  // 즐겨찾기 우선 → 그 안에서 점수 내림차순 (대시보드 즐겨찾기와 연동)
  const byStage = (sk) => visible.filter((it) => it.stage === sk).sort((a, b) =>
    ((favSet.has(b.id) ? 1 : 0) - (favSet.has(a.id) ? 1 : 0)) || (b.dScore - a.dScore));

  const open = openId ? items.find((x) => x.id === openId) : null;

  return (
    <div className="g-pad g-up" style={{ height: '100%', display: 'flex', flexDirection: 'column', maxWidth: 'none' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>접촉 파이프라인 · 내 관리 대상 {items.length}곳</div>
          <h1 className="g-head" style={{ fontSize: 24, margin: 0 }}>어디까지 진행됐나요?</h1>
          <p className="tx-2" style={{ fontSize: 13.5, margin: '6px 0 0' }}>카드는 <b>점수 높은 순</b>으로 정렬돼요. <b>드래그</b>로 단계를 옮기고, <b>눌러</b> 메모를 남기세요.</p>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 섹션 색상 범례 */}
          <div className="g-klegend">
            {(window.ADE.sections || []).map((s) => PL_SEC_COLORS[s.key] && (
              <span key={s.key}><i style={{ background: PL_SEC_COLORS[s.key] }} />{s.label}</span>
            ))}
          </div>
          <div className="g-pl-search">
            <GIcon name="search" size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="기업·업종 검색" />
            {q && <button onClick={() => setQ('')}><GIcon name="close" size={14} /></button>}
          </div>
        </div>
      </div>

      {/* 칸반 보드 */}
      <div className="g-kanban">
        {stages.map((st) => {
          const list = byStage(st.key);
          return (
            <div key={st.key}
              className={`g-kcol ${overStage === st.key ? 'over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOverStage(st.key); }}
              onDragLeave={(e) => { if (e.currentTarget === e.target) setOverStage(null); }}
              onDrop={() => { if (dragId) moveTo(dragId, st.key); setDragId(null); setOverStage(null); }}>
              <div className="g-kcol-hd" style={{ '--sc': st.color }}>
                <span className="g-kdot" style={{ background: st.color }} />
                <span className="g-kcol-t">{st.label}</span>
                <span className="g-kcount">{list.length}</span>
                <span className="g-kcol-sub">{st.sub}</span>
              </div>
              <div className="g-kcol-body">
                {list.map((it) => (
                  <article key={it.id}
                    className={`g-kcard ${dragId === it.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => { setDragId(it.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    onClick={() => setOpenId(it.id)}
                    style={{ '--gc': st.color, '--sec': plSecColor(it.parent) }}>
                    <span className="g-kgrade" style={{ background: st.color }} />
                    <div className="g-kcard-main">
                      <div className="g-kcard-top">
                        <span className="g-kcard-name">{it.name}</span>
                        <span className="g-kscore-badge g-mono">{it.dScore}</span>
                      </div>
                      <div className="g-kcard-sub">{it.cgName} · {it.tier}차 · {it.sector}</div>
                      <div className="g-kmemo-wrap">
                        {it.memo
                          ? <div className="g-kmemo"><GIcon name="note" size={12} /><span>{it.memo}</span></div>
                          : <div className="g-kmemo empty"><GIcon name="note" size={12} /><span>메모 없음 — 눌러서 추가</span></div>}
                      </div>
                      <div className="g-kcard-foot">
                        {it.lastContact
                          ? <span className="g-klast"><GIcon name="clock" size={12} />최근 접촉 {fmtDate(it.lastContact)}</span>
                          : <span className="g-klast" style={{ opacity: .6 }}><GIcon name="clock" size={12} />미접촉</span>}
                      </div>
                    </div>
                    {/* 우측 레일: 드래그 핸들(점 6개) 아래 즐겨찾기 별 */}
                    <div className="g-kside">
                      <span className="g-kdrag"><GIcon name="drag" size={15} /></span>
                      <button className={`g-favbtn g-kfav ${favSet.has(it.id) ? 'on' : ''}`}
                        title={favSet.has(it.id) ? '즐겨찾기 해제' : '즐겨찾기'}
                        onClick={(e) => { e.stopPropagation(); toggleFav && toggleFav(it.id); }}>
                        <GIcon name={favSet.has(it.id) ? 'star-fill' : 'star'} size={15} />
                      </button>
                    </div>
                  </article>
                ))}
                {list.length === 0 && (
                  <div className="g-kempty">여기로 카드를 끌어다 놓으세요</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 상세 드로어 */}
      {open && (
        <React.Fragment>
          <div className="g-pl-scrim" onClick={() => setOpenId(null)} />
          <aside className="g-pl-drawer g-pl-slide">
            <div className="g-pl-dhd">
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>{open.cgName} · {open.tier}차 협력사</div>
                <h2 className="g-head" style={{ fontSize: 21, margin: 0 }}>{open.name}</h2>
                <div className="tx-3" style={{ fontSize: 12.5, marginTop: 3 }}>{open.sector} · {open.listed ? '상장사' : '비상장'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className={`g-favbtn ${favSet.has(open.id) ? 'on' : ''}`}
                  title={favSet.has(open.id) ? '즐겨찾기 해제' : '즐겨찾기'}
                  onClick={() => toggleFav && toggleFav(open.id)}>
                  <GIcon name={favSet.has(open.id) ? 'star-fill' : 'star'} size={17} />
                </button>
                <button className="g-pl-x" onClick={() => setOpenId(null)}><GIcon name="close" size={18} /></button>
              </div>
            </div>

            <div className="g-pl-dmetrics">
              <div className="g-pl-metric">
                <span className="l">D-Score</span>
                <span className="v g-mono">{open.dScore}</span>
              </div>
              <div className="g-pl-metric">
                <span className="l">최근 접촉</span>
                <span className="v" style={{ fontSize: 16, marginTop: 6 }}>{open.lastContact ? fmtDate(open.lastContact) : '—'}</span>
              </div>
            </div>

            {/* 단계 변경 */}
            <div className="g-pl-sec">
              <div className="g-pl-label"><GIcon name="kanban" size={14} />단계</div>
              <div className="g-pl-stages">
                {stages.map((st) => (
                  <button key={st.key}
                    className={`g-pl-stage ${open.stage === st.key ? 'on' : ''}`}
                    style={open.stage === st.key ? { '--sc': st.color, borderColor: st.color, color: st.color, background: st.color + '18' } : {}}
                    onClick={() => moveTo(open.id, st.key)}>
                    <span className="g-kdot" style={{ background: st.color }} />{st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div className="g-pl-sec" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div className="g-pl-label"><GIcon name="note" size={14} />접촉 메모</div>
              <textarea className="g-pl-memo"
                value={open.memo}
                placeholder="통화·미팅 내용, 다음 액션, 담당자 연락처 등을 기록하세요. 자동 저장됩니다."
                onChange={(e) => patch(open.id, { memo: e.target.value })} />
              {open.lastContact && (
                <div className="tx-3" style={{ fontSize: 11.5, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GIcon name="clock" size={12} />최근 접촉 {fmtDate(open.lastContact)}
                </div>
              )}
            </div>

            <button className="g-btn primary" style={{ width: '100%', marginTop: 4 }} onClick={() => onOpenCompany(open.id)}>
              <GIcon name="doc" size={17} />기업 대시보드 열기
            </button>
          </aside>
        </React.Fragment>
      )}
    </div>
  );
}

function fmtDate(iso) {
  const d = new Date(iso), now = new Date();
  const days = Math.floor((now - d) / 86400000);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

window.GPipeline = GPipeline;
