/* ============================================================================
 *  "가이드" 디자인 프리미티브 (구 components.jsx → TS 모듈)
 *  - window.G 전역 대신 ES 모듈 export
 *  - 색/폰트 토큰은 styles/guide.css 의 CSS 변수를 참조
 * ========================================================================== */
import { useEffect, useState } from "react";

export type Grade = "POSITIVE" | "NEGATIVE" | "MONITOR";

export const GRADES: Record<Grade, { key: Grade; label: string; short: string; color: string }> = {
  POSITIVE: { key: "POSITIVE", label: "숨은 진주", short: "진주", color: "#00b87a" },
  NEGATIVE: { key: "NEGATIVE", label: "거품 경보", short: "경보", color: "#f5455f" },
  MONITOR:  { key: "MONITOR",  label: "모니터링",  short: "관찰", color: "#e6920a" },
};

export const gColor = (k: Grade) =>
  ({ POSITIVE: "var(--g-pos)", NEGATIVE: "var(--g-neg)", MONITOR: "var(--g-mon)" }[k]);
export const gSoft = (k: Grade) =>
  ({ POSITIVE: "var(--g-pos-soft)", NEGATIVE: "var(--g-neg-soft)", MONITOR: "var(--g-mon-soft)" }[k]);

/* ---- 용어 사전 (초보자 핵심) ---- */
export const GLOSSARY: Record<string, string> = {
  "D-Score": "기업이 공시에서 <b>말한 내용</b>과 특허·R&D 같은 <b>실제 행동</b>이 얼마나 일치하는지를 0~100으로 점수화한 지표입니다. 높을수록 진짜 우량.",
  "숨은 진주": "공시에서 크게 드러나지 않았지만, 특허·R&D 등 실제 행동 지표가 앞서가는 <b>저평가 우량 협력사</b>입니다. 선제 영업 대상.",
  "거품 경보": "공시·기대는 화려하지만 실제 행동(특허·발명자)이 따라오지 못하는 기업입니다. <b>여신 리스크 조기 경보</b> 대상.",
  "모니터링": "아직 방향이 분명하지 않아 <b>추세를 지켜봐야 하는</b> 기업입니다.",
  "공시-행동 괴리": "공시 기대치 대비 실제 행동의 차이(p). <b>+면 행동이 앞섬(좋음)</b>, −면 행동이 뒤처짐(주의).",
  "신호 강도": "대기업 공시에서 해당 테마가 얼마나 강하고 반복적으로 언급되는지를 나타냅니다.",
  "협력 차수": "대기업과의 거래 단계. 1차는 직접 납품, 2·3차는 그 아래 단계 협력사입니다.",
  "역방향 조회": "“이런 일이 생기면 누가 수혜를 볼까?”를 거꾸로 추적해 협력사를 찾는 기능입니다.",
};

/* 용어 — 점선 밑줄 + 호버 풀이 */
export function Term({ children, k }: { children: React.ReactNode; k?: string }) {
  const key = k || (typeof children === "string" ? children : "");
  const def = GLOSSARY[key];
  return (
    <span className="term">
      {children}
      {def && <span className="tip" dangerouslySetInnerHTML={{ __html: def }} />}
    </span>
  );
}

/* 아이콘 */
export function Icon({ name, size = 20, stroke = 1.7 }: { name: string; size?: number; stroke?: number }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "home": return <svg {...p}><path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /></svg>;
    case "network": return <svg {...p}><circle cx="12" cy="12" r="2.4" /><circle cx="5" cy="5" r="1.8" /><circle cx="19" cy="5" r="1.8" /><circle cx="5" cy="19" r="1.8" /><circle cx="19" cy="19" r="1.8" /><path d="M10.3 10.3 6.4 6.4M13.7 10.3l3.9-3.9M10.3 13.7l-3.9 3.9M13.7 13.7l3.9 3.9" /></svg>;
    case "search": return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M8.5 11h5M11.5 8.5 14 11l-2.5 2.5" /></svg>;
    case "pearl": return <svg {...p}><circle cx="12" cy="13" r="6" /><path d="M12 7V3M9 5 7 3M15 5l2-2" /></svg>;
    case "alert": return <svg {...p}><path d="M12 9v4M12 17v.5M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>;
    case "eye": return <svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="2.6" /></svg>;
    case "doc": return <svg {...p}><path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M8 13h8M8 17h5" /></svg>;
    case "sun": return <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
    case "moon": return <svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>;
    case "chevron": return <svg {...p}><path d="m9 18 6-6-6-6" /></svg>;
    case "chevron-left": return <svg {...p}><path d="m15 18-6-6 6-6" /></svg>;
    case "arrow": return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case "up": return <svg {...p}><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
    case "down": return <svg {...p}><path d="M12 5v14M6 13l6 6 6-6" /></svg>;
    case "close": return <svg {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>;
    case "check": return <svg {...p}><path d="M20 6 9 17l-5-5" /></svg>;
    case "info": return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></svg>;
    case "spark": return <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>;
    case "logout": return <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>;
    case "bell": return <svg {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>;
    case "refresh": return <svg {...p}><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" /></svg>;
    case "chart": return <svg {...p}><path d="M3 3v18h18M7 15l3-4 3 3 4-6" /></svg>;
    default: return null;
  }
}

/* 등급 pill */
export function Pill({ grade, soft = true }: { grade: Grade; soft?: boolean }) {
  const c = gColor(grade);
  const label = GRADES[grade].label;
  return (
    <span className="g-pill" style={{ color: c, background: soft ? gSoft(grade) : "transparent", border: soft ? "none" : `1px solid ${c}` }}>
      <span className="d" style={{ background: c }} />
      {label}
    </span>
  );
}

/* 점수 바 */
export function ScoreBar({ value, grade, showNum = true, h = 9 }: { value: number; grade: Grade; showNum?: boolean; h?: number }) {
  const c = gColor(grade);
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 60); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <div className="g-scorebar" style={{ flex: 1, height: h }}>
        <i style={{ width: w + "%", background: c, transition: "width .8s var(--g-ease)" }} />
      </div>
      {showNum && <span className="tnum g-mono" style={{ fontSize: 14, fontWeight: 600, color: c, width: 26, textAlign: "right" }}>{value}</span>}
    </div>
  );
}

/* 원형 점수 (도넛) */
export function Donut({ value, grade, size = 150 }: { value: number; grade: Grade; size?: number }) {
  const c = gColor(grade);
  const r = size / 2 - 13, cx = size / 2, circ = 2 * Math.PI * r;
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(value), 80); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth="11" />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={c} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${(p / 100) * circ} ${circ}`} transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: "stroke-dasharray 1s var(--g-ease)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span className="tnum g-head" style={{ fontSize: size * 0.27, fontWeight: 700, color: c, lineHeight: 1 }}>{value}</span>
        <span className="eyebrow" style={{ fontSize: 10, marginTop: 3 }}>D-SCORE</span>
      </div>
    </div>
  );
}

/* 신호 강도 도트 */
export function SignalDots({ value, dots = 5 }: { value: number; dots?: number }) {
  const on = Math.round((value / 100) * dots);
  return (
    <span style={{ display: "inline-flex", gap: 4 }} title={`신호 강도 ${value}`}>
      {Array.from({ length: dots }).map((_, i) => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < on ? "var(--g-brand)" : "var(--line)" }} />
      ))}
    </span>
  );
}

/* 상대 시각 */
export function gRel(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (d < 1) return Math.max(1, Math.round(d * 60)) + "분 전";
  if (d < 24) return Math.round(d) + "시간 전";
  return Math.round(d / 24) + "일 전";
}

/* 카운트업 */
export function useCount(target: number, dur = 700): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0, s = 0;
    const tick = (t: number) => {
      if (!s) s = t;
      const p = Math.min(1, (t - s) / dur);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return n;
}

/* 워드마크 로고 */
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="var(--g-brand-soft)" stroke="var(--g-brand)" strokeWidth="1.4" />
        <circle cx="20" cy="20" r="3.4" fill="var(--g-brand)" />
        <circle cx="11" cy="12" r="2" fill="var(--g-pos)" /><circle cx="29" cy="13" r="2" fill="var(--g-mon)" /><circle cx="28" cy="29" r="2" fill="var(--g-neg)" />
        <path d="M13 13 17 17M27.5 14 22.5 18.5M26.5 27.5 22 22.5" stroke="var(--g-brand)" strokeOpacity=".5" strokeWidth="1.2" />
      </svg>
      <div style={{ lineHeight: 1.05 }}>
        <div className="g-head" style={{ fontSize: 18, fontWeight: 800 }}>Cash<span style={{ color: "var(--brand-tx)" }}>Map</span></div>
        <div className="g-mono tx-3" style={{ fontSize: 10, letterSpacing: ".14em" }}>×ADE</div>
      </div>
    </div>
  );
}

/* 테마 토글 (light/dark) */
export function ThemeToggle({ theme, setTheme }: { theme: "light" | "dark"; setTheme: (t: "light" | "dark") => void }) {
  return (
    <div className="g-theme">
      <button className={theme === "light" ? "on" : ""} onClick={() => setTheme("light")} title="라이트 모드"><Icon name="sun" size={17} /></button>
      <button className={theme === "dark" ? "on" : ""} onClick={() => setTheme("dark")} title="다크 모드"><Icon name="moon" size={17} /></button>
    </div>
  );
}
