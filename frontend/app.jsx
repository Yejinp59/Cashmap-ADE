/* ============================================================================
 *  CashMap × ADE — 앱 셸
 *  로그인 · 대시보드 · 역방향 조회 · 기업 상세 + 네온 공급망 지도 · 라이트/다크
 * ========================================================================== */
const A4_NAV = [
  { key: 'dash', label: '대시보드', desc: '오늘의 신호 한눈에', icon: 'home' },
  { key: 'network', label: '공급망 지도', desc: '네온 네트워크 보기', icon: 'network' },
  { key: 'reverse', label: '역방향 조회', desc: '시나리오로 찾기', icon: 'search' },
  { key: 'pipeline', label: '접촉 파이프라인', desc: 'RM 영업 칸반', icon: 'kanban' },
];

function A4App() {
  const { GIcon } = window.G;
  // 로그인 세션 유지: localStorage 에 저장 → 새로고침해도 유지
  const [user, setUserState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cashmap.user') || 'null'); } catch (e) { return null; }
  });
  const setUser = (u) => {
    setUserState(u);
    try { u ? localStorage.setItem('cashmap.user', JSON.stringify(u)) : localStorage.removeItem('cashmap.user'); } catch (e) {}
  };
  const [route, setRoute] = useState('dash');
  const [selected, setSelected] = useState(null);
  const [focusCg, setFocusCg] = useState(null);
  // 대시보드 A(대안 1)는 로그인 직후가 아니라, 리스트에서 기업을 선택했을 때 표시
  const [activeCompany, setActiveCompany] = useState(null);
  // 진입 화면 우측 리스트의 현재 섹션 (즐겨찾기 'fav' | 섹션 key)
  const [section, setSection] = useState('semi');
  // 즐겨찾기 (사용자별 · localStorage)
  const [favs, setFavs] = useState([]);
  useEffect(() => { setFavs(user ? window.ADE.loadFavs(user.empId) : []); }, [user]);
  const toggleFav = (id) => setFavs((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    if (user) window.ADE.saveFavs(user.empId, next);
    return next;
  });
  const openCompanyDash = (id) => { setActiveCompany(id); setSelected(null); setRoute('dash'); };
  const goHub = () => { setActiveCompany(null); setRoute('dash'); };

  // 테마 (localStorage 저장 → 선택 유지)
  const [theme, setThemeState] = useState(() => { try { return localStorage.getItem('cashmap.theme') || 'dark'; } catch (e) { return 'dark'; } });
  const setTheme = (t) => { setThemeState(t); try { localStorage.setItem('cashmap.theme', t); } catch (e) {} };
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  useEffect(() => {
    if (!user) return;
    const h = (e) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [user]);

  const openNetwork = (cgId, coId) => { setFocusCg(cgId); setRoute('network'); setSelected(coId); };

  if (!user) return <GLogin onLogin={setUser} theme={theme} setTheme={setTheme} />;

  return (
    <div className="g-shell">
      <nav className="g-side">
        <div className="g-side-hd"><GWordmark /></div>
        <div className="g-side-nav">
          {A4_NAV.map((n) => (
            <div key={n.key} className={`g-navitem ${route === n.key ? 'active' : ''}`} onClick={() => (n.key === 'dash' ? goHub() : setRoute(n.key))}>
              <span className="ico"><GIcon name={n.icon} size={20} /></span>
              <div><div>{n.label}</div><div className="desc">{n.desc}</div></div>
            </div>
          ))}
        </div>
        <div className="g-side-ft">
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--g-brand-soft)', color: 'var(--brand-tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flex: 'none' }}>RM</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{user.empId}</div>
              <div className="tx-3" style={{ fontSize: 11.5 }}>기업금융팀</div>
            </div>
            <button className="g-btn ghost" style={{ padding: 7, color: 'var(--tx-3)' }} title="로그아웃" onClick={() => setUser(null)}><GIcon name="logout" size={17} /></button>
          </div>
          <GThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </nav>

      <div className="g-main">
        <div className="g-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 className="g-head" style={{ fontSize: 17, margin: 0 }}>{A4_NAV.find((n) => n.key === route)?.label}</h2>
            <span className="tx-3" style={{ fontSize: 13 }}>{route === 'dash' && activeCompany ? '선택 기업 대시보드' : A4_NAV.find((n) => n.key === route)?.desc}</span>
          </div>
          <div style={{ flex: 1 }} />
          <GWarmStatus />
          {(() => {
            // live-mix: Supabase 실 D-Score 기업이 '실데이터' 섹션으로 화면에 올라온 상태
            // mock-demo: 서버·AI(EXAONE)는 연결됐지만 실 D-Score가 아직 없어 데모 화면 유지
            // mock: 백엔드 자체가 안 닿음 (오프라인)
            const src = window.ADE.source;
            const label = src === 'live-mix' ? 'Supabase 연결됨'
                        : src === 'live'     ? '실데이터 연결됨'
                        : window.ADE.online  ? '서버·AI 연결됨 · 데모 화면'
                        :                      '오프라인 · 데모 데이터';
            const dot = (src === 'live-mix' || src === 'live') ? 'var(--g-pos)'
                      : window.ADE.online ? 'var(--g-brand)' : 'var(--g-mon)';
            return (
              <div className="tx-3" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}
                   title={`데이터 소스: ${src} · API: ${window.ADE.API_BASE || '같은 오리진(nginx 프록시)'}`}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />
                {label}
              </div>
            );
          })()}
        </div>

        <div className="g-scroll" style={(route === 'network' || route === 'pipeline' || (route === 'dash' && !activeCompany)) ? { display: 'flex', overflow: 'hidden' } : {}}>
          {route === 'dash' && (activeCompany
            ? <GCompanyDash companyId={activeCompany} onBack={goHub} onOpenCompany={openCompanyDash} onOpenNetwork={openNetwork} favs={favs} toggleFav={toggleFav} />
            : <GHub user={user} section={section} setSection={setSection} favs={favs} toggleFav={toggleFav} onOpenCompany={openCompanyDash} />)}
          {route === 'network' && <A4NetworkView onSelectCompany={setSelected} selectedId={selected} focusCg={focusCg} setFocusCg={setFocusCg} />}
          {route === 'pipeline' && <GPipeline user={user} onOpenCompany={openCompanyDash} />}
          {route === 'reverse' && <GReverse onSelectCompany={setSelected} />}
        </div>

        <GDetail companyId={selected} onClose={() => setSelected(null)} onOpenNetwork={openNetwork} />
      </div>

      <nav className="g-mobnav">
        {A4_NAV.map((n) => (
          <button key={n.key} className={route === n.key ? 'on' : ''} onClick={() => (n.key === 'dash' ? goHub() : setRoute(n.key))}>
            <GIcon name={n.icon} size={21} />{n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* 리포트 사전 생성 진행 표시 — 워밍업(야간 배치와 같은 발상)이 도는 동안만 보인다 */
function GWarmStatus() {
  const [st, setSt] = useState(() => ({ ...(window.ADE.warmup || {}) }));
  useEffect(() => {
    const t = setInterval(() => setSt({ ...(window.ADE.warmup || {}) }), 1500);
    return () => clearInterval(t);
  }, []);
  if (!st.running) return null;
  return (
    <span className="tx-3" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}
          title={`AI 리포트 사전 생성 중 (현재: ${st.current || '…'}) — 열면 이미 있도록 미리 만들어 둡니다`}>
      <span className="g-warmdot" />리포트 사전 생성 {st.done}/{st.total}
    </span>
  );
}

// 첫 렌더 전에 백엔드 연결 여부를 확인해 데이터 소스(live/mock)를 결정한다 (요청 #1)
const _rootEl = document.getElementById('root');
_rootEl.innerHTML = '<div style="height:100vh;display:flex;align-items:center;justify-content:center;color:#7d96a8;font-family:Noto Sans KR,sans-serif;font-size:14px">데이터 연결 확인 중…</div>';
window.ADE.bootstrap().finally(() => {
  ReactDOM.createRoot(_rootEl).render(<A4App />);
  // 부팅 4초 뒤 리포트 서사 사전 생성 시작 (백엔드 연결 시에만) — "열면 이미 있다"
  if (window.ADE.online && window.ADE.warmupNarratives) {
    setTimeout(() => window.ADE.warmupNarratives(), 4000);
  }
});
