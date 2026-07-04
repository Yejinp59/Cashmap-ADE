import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { useHealth } from "./hooks";
import { useTheme } from "./useTheme";
import { canSee, roleKor } from "./permissions";
import { Icon, Wordmark, ThemeToggle } from "./components/guide";

interface NavItem { to: string; label: string; desc: string; icon: string; widgetId: string }

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard",  label: "대시보드",      desc: "오늘의 신호 한눈에", icon: "home",    widgetId: "navDashboard" },
  { to: "/network",    label: "공급망 지도",   desc: "네온 네트워크 보기", icon: "network", widgetId: "navNetwork" },
  { to: "/reverse",    label: "역방향 조회",   desc: "시나리오로 찾기",    icon: "search",  widgetId: "navReverse" },
  { to: "/validation", label: "백테스팅 결과", desc: "모델 신뢰도 검증",   icon: "chart",   widgetId: "navValidation" },
];

const TITLES: Record<string, { label: string; desc: string }> = {
  "/dashboard":  { label: "대시보드",        desc: "오늘의 신호 한눈에" },
  "/network":    { label: "공급망 지도",     desc: "누가 누구에게 연결돼 있나" },
  "/reverse":    { label: "역방향 조회",     desc: "시나리오로 수혜 기업 찾기" },
  "/validation": { label: "백테스팅 결과",   desc: "모델 신뢰도 검증" },
  "/company":    { label: "기업 상세",       desc: "행동 지표와 공시 근거" },
  "/disclosure": { label: "공시 뷰어",       desc: "신호 문장 하이라이트" },
  "/report":     { label: "RM 리포트",       desc: "영업 액션 리포트" },
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { error: dbError, loading: dbLoading } = useHealth();
  const location = useLocation();
  const role = user?.role;

  const base = "/" + (location.pathname.split("/")[1] || "");
  const title = TITLES[base] ?? { label: "CashMap × ADE", desc: "" };
  const isNetwork = base === "/network";
  const visibleNav = NAV_ITEMS.filter((n) => canSee(n.widgetId, role!));

  const dbStatus = dbError
    ? { text: "DB 오류", color: "var(--g-neg)" }
    : dbLoading
    ? { text: "연결 중…", color: "var(--g-mon)" }
    : { text: "공시 스트림 연결됨", color: "var(--g-pos)" };

  const initials = user?.name?.slice(0, 2) ?? roleKor(role!)?.slice(0, 2) ?? "RM";

  return (
    <div className="g-shell">
      {/* ── Sidebar ── */}
      <nav className="g-side">
        <div className="g-side-hd"><Wordmark /></div>

        <div className="g-side-nav">
          {visibleNav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => `g-navitem ${isActive ? "active" : ""}`}
            >
              <span className="ico"><Icon name={n.icon} size={20} /></span>
              <div>
                <div>{n.label}</div>
                <div className="desc">{n.desc}</div>
              </div>
            </NavLink>
          ))}
        </div>

        <div className="g-side-ft">
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--g-brand-soft)", color: "var(--brand-tx)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flex: "none" }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                <div className="tx-3" style={{ fontSize: 11.5 }}>{roleKor(role!)}</div>
              </div>
              <button className="g-btn ghost" style={{ padding: 7, color: "var(--tx-3)" }} title="로그아웃" onClick={logout}>
                <Icon name="logout" size={17} />
              </button>
            </div>
          )}
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </nav>

      {/* ── Main column ── */}
      <div className="g-main">
        <div className="g-top">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 className="g-head" style={{ fontSize: 17, margin: 0 }}>{title.label}</h2>
            {title.desc && <span className="tx-3" style={{ fontSize: 13 }}>{title.desc}</span>}
          </div>
          <div style={{ flex: 1 }} />
          <div className="tx-3" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: dbStatus.color }} />
            {dbStatus.text}
          </div>
        </div>

        <div className="g-scroll" style={isNetwork ? { display: "flex", overflow: "hidden" } : undefined}>
          <Outlet />
        </div>
      </div>

      {/* ── Mobile nav ── */}
      <nav className="g-mobnav">
        {visibleNav.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? "on" : "")}>
            <Icon name={n.icon} size={21} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
