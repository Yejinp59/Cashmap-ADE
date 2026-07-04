import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { useTheme } from "./useTheme";
import { Icon, Wordmark, ThemeToggle } from "./components/guide";

export default function LoginPage() {
  const { user, login } = useAuth() as any;
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [empId, setEmpId] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  if (user) {
    const from = (location.state as any)?.from?.pathname || "/dashboard";
    return <Navigate to={from} replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId || !pw) { setErr("사번과 비밀번호를 입력해 주세요."); return; }
    setErr(""); setLoading(true);
    try {
      await login(empId, pw);
      const from = (location.state as any)?.from?.pathname || "/dashboard";
      navigate(from, { replace: true });
    } catch (e: any) {
      setErr(e.message || "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="g-login">
      {/* 좌측 브랜드 아트 */}
      <div className="g-login-art">
        <div style={{ position: "absolute", inset: 0, opacity: 0.5, backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,.18), transparent 35%), radial-gradient(circle at 80% 70%, rgba(255,255,255,.12), transparent 40%)" }} />
        <svg viewBox="0 0 400 400" style={{ position: "absolute", width: "70%", maxWidth: 460, opacity: 0.9 }}>
          <g stroke="rgba(255,255,255,.35)" strokeWidth="1.2" fill="none">
            <path d="M200 200 L90 90M200 200 L320 110M200 200 L100 300M200 200 L310 300M200 200 L200 70M200 200 L70 200" />
          </g>
          {([[90, 90, "#00e5a0"], [320, 110, "#f5a623"], [100, 300, "#ffffff"], [310, 300, "#f5455f"], [200, 70, "#00e5a0"], [70, 200, "#ffffff"]] as [number, number, string][]).map(([x, y, c], i) => (
            <circle key={i} cx={x} cy={y} r="8" fill={c} opacity=".95" />
          ))}
          <circle cx="200" cy="200" r="16" fill="#fff" />
          <circle cx="200" cy="200" r="26" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" />
        </svg>
        <div style={{ position: "absolute", bottom: 56, left: 56, right: 56, color: "#fff" }}>
          <div className="g-head" style={{ fontSize: 32, lineHeight: 1.2, fontWeight: 800, letterSpacing: "-.02em" }}>
            공시가 말하기 전,<br />수혜 기업을 먼저 찾다
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.7, marginTop: 16, opacity: 0.9, maxWidth: 400 }}>
            대기업 공시를 AI가 읽고, 진짜 행동하는 협력사를 D-Score로 골라냅니다. 처음이어도 괜찮아요 — 화면이 안내해 드립니다.
          </p>
        </div>
      </div>

      {/* 우측 폼 */}
      <div className="g-login-form g-up">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <Wordmark />
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>

        <h1 className="g-head" style={{ fontSize: 26, margin: "0 0 8px" }}>다시 오신 것을 환영합니다</h1>
        <p className="tx-2" style={{ margin: "0 0 30px", fontSize: 14.5 }}>하나은행 기업금융팀 전용 여신 인텔리전스 콘솔입니다.</p>

        <form onSubmit={submit}>
          <label className="eyebrow" style={{ display: "block", marginBottom: 9 }}>사번</label>
          <input className="g-input" value={empId} onChange={(e) => setEmpId(e.target.value)} placeholder="예) rm01" autoFocus style={{ marginBottom: 18 }} />

          <label className="eyebrow" style={{ display: "block", marginBottom: 9 }}>비밀번호</label>
          <input className="g-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" style={{ marginBottom: err ? 12 : 24 }} />

          {err && <div style={{ color: "var(--g-neg)", fontSize: 13, marginBottom: 18 }}>⚠ {err}</div>}

          <button className="g-btn primary lg" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "확인 중…" : "로그인"}{!loading && <Icon name="arrow" size={18} />}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
          <span className="tx-3" style={{ fontSize: 12.5 }}>SSO · OTP 2차 인증 적용</span>
          <button className="g-chip" type="button" onClick={() => { setEmpId("rm01"); setPw("1234"); }}>데모 자동입력</button>
        </div>
      </div>
    </div>
  );
}
