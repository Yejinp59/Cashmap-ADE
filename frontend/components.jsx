/* ============================================================================
 *  3안 "가이드" 프리미티브  →  window.G
 *  초보자 친화: 용어풀이 툴팁, 친절한 라벨, 명확한 컴포넌트
 * ========================================================================== */
const { useState, useEffect, useRef, useMemo } = React;

const GG = window.ADE.GRADES;
const gColor = (k) => ({ POSITIVE: 'var(--g-pos)', NEGATIVE: 'var(--g-neg)', MONITOR: 'var(--g-mon)' }[k]);
const gSoft = (k) => ({ POSITIVE: 'var(--g-pos-soft)', NEGATIVE: 'var(--g-neg-soft)', MONITOR: 'var(--g-mon-soft)' }[k]);

/* ---- 용어 사전 (초보자 핵심) ---- */
const GLOSSARY = {
  'D-Score': '기업이 공시에서 <b>말한 내용</b>과 특허·R&D 같은 <b>실제 행동</b>이 얼마나 일치하는지를 0~100으로 점수화한 지표입니다. 높을수록 진짜 우량.',
  '숨은 진주': '공시에서 크게 드러나지 않았지만, 특허·R&D 등 실제 행동 지표가 앞서가는 <b>저평가 우량 협력사</b>입니다. 선제 영업 대상.',
  '거품 경보': '공시·기대는 화려하지만 실제 행동(특허·발명자)이 따라오지 못하는 기업입니다. <b>여신 리스크 조기 경보</b> 대상.',
  '모니터링': '아직 방향이 분명하지 않아 <b>추세를 지켜봐야 하는</b> 기업입니다.',
  '공시-행동 괴리': '공시 기대치 대비 실제 행동의 차이(p). <b>+면 행동이 앞섬(좋음)</b>, −면 행동이 뒤처짐(주의).',
  '신호 강도': '대기업 공시에서 해당 테마가 얼마나 강하고 반복적으로 언급되는지를 나타냅니다.',
  '협력 차수': '대기업과의 거래 단계. 1차는 직접 납품, 2·3차는 그 아래 단계 협력사입니다.',
  '역방향 조회': '“이런 일이 생기면 누가 수혜를 볼까?”를 거꾸로 추적해 협력사를 찾는 기능입니다.',
};

/* 용어 — 점선 밑줄 + 호버 풀이 */
function Term({ children, k }) {
  const def = GLOSSARY[k || children];
  return (
    <span className="term">{children}
      {def && <span className="tip" dangerouslySetInnerHTML={{ __html: def }} />}
    </span>
  );
}

/* 아이콘 */
function GIcon({ name, size = 20, stroke = 1.7 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home': return <svg {...p}><path d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/></svg>;
    case 'network': return <svg {...p}><circle cx="12" cy="12" r="2.4"/><circle cx="5" cy="5" r="1.8"/><circle cx="19" cy="5" r="1.8"/><circle cx="5" cy="19" r="1.8"/><circle cx="19" cy="19" r="1.8"/><path d="M10.3 10.3 6.4 6.4M13.7 10.3l3.9-3.9M10.3 13.7l-3.9 3.9M13.7 13.7l3.9 3.9"/></svg>;
    case 'search': return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8.5 11h5M11.5 8.5 14 11l-2.5 2.5"/></svg>;
    case 'pearl': return <svg {...p}><circle cx="12" cy="13" r="6"/><path d="M12 7V3M9 5 7 3M15 5l2-2"/></svg>;
    case 'alert': return <svg {...p}><path d="M12 9v4M12 17v.5M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>;
    case 'eye': return <svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="2.6"/></svg>;
    case 'doc': return <svg {...p}><path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M8 13h8M8 17h5"/></svg>;
    case 'sun': return <svg {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;
    case 'moon': return <svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>;
    case 'chevron': return <svg {...p}><path d="m9 18 6-6-6-6"/></svg>;
    case 'arrow': return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'up': return <svg {...p}><path d="M12 19V5M6 11l6-6 6 6"/></svg>;
    case 'down': return <svg {...p}><path d="M12 5v14M6 13l6 6 6-6"/></svg>;
    case 'close': return <svg {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>;
    case 'download': return <svg {...p}><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>;
    case 'check': return <svg {...p}><path d="M20 6 9 17l-5-5"/></svg>;
    case 'info': return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/></svg>;
    case 'spark': return <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>;
    case 'logout': return <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>;
    case 'chip': return <svg {...p}><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3"/></svg>;
    case 'ship': return <svg {...p}><path d="M3 14.5 12 11l9 3.5M5 11.5V8a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3.5M12 3v4M3 14.5l1.5 4.2A2 2 0 0 0 6.4 20h11.2a2 2 0 0 0 1.9-1.3L21 14.5"/></svg>;
    case 'bolt': return <svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>;
    case 'solar': return <svg {...p}><rect x="3" y="4" width="18" height="11" rx="1"/><path d="M3 8h18M9 4v11M15 4v11M10 19h4M12 15v4"/></svg>;
    case 'pill': return <svg {...p}><rect x="3" y="8" width="18" height="8" rx="4"/><path d="M12 8v8"/></svg>;
    case 'star': return <svg {...p}><path d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 17l-5.4 2.7 1.2-6.1-4.5-4.2 6.1-.8z"/></svg>;
    case 'star-fill': return <svg {...p} fill="currentColor" stroke="none"><path d="m12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 17l-5.4 2.7 1.2-6.1-4.5-4.2 6.1-.8z"/></svg>;
    case 'back': return <svg {...p}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>;
    case 'building': return <svg {...p}><path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 21V9h3a1 1 0 0 1 1 1v11M3 21h18M8.5 8h2M8.5 12h2M8.5 16h2"/></svg>;
    case 'grid': return <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case 'kanban': return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v7M13 7v10M18 7v4"/></svg>;
    case 'note': return <svg {...p}><path d="M4 4h16v11l-5 5H4z"/><path d="M20 15h-5v5M8 9h8M8 13h4"/></svg>;
    case 'drag': return <svg {...p}><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>;
    case 'clock': return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    default: return null;
  }
}

/* 등급 pill */
function GPill({ grade, soft = true }) {
  const c = gColor(grade), label = GG[grade].label;
  return <span className="g-pill" style={{ color: c, background: soft ? gSoft(grade) : 'transparent', border: soft ? 'none' : `1px solid ${c}` }}>
    <span className="d" style={{ background: c }} />{label}
  </span>;
}

/* 점수 바 */
function GScoreBar({ value, grade, showNum = true, h = 9 }) {
  const c = gColor(grade);
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(value), 60); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <div className="g-scorebar" style={{ flex: 1, height: h }}>
        <i style={{ width: w + '%', background: c, transition: 'width .8s var(--g-ease)' }} />
      </div>
      {showNum && <span className="tnum g-mono" style={{ fontSize: 14, fontWeight: 600, color: c, width: 26, textAlign: 'right' }}>{value}</span>}
    </div>
  );
}

/* 원형 점수 (상세용, 친근한 도넛) */
function GDonut({ value, grade, size = 150 }) {
  const c = gColor(grade);
  const r = size / 2 - 13, cx = size / 2, circ = 2 * Math.PI * r;
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(value), 80); return () => clearTimeout(t); }, [value]);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth="11" />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={c} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={`${(p / 100) * circ} ${circ}`} transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: 'stroke-dasharray 1s var(--g-ease)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span className="tnum g-head" style={{ fontSize: size * 0.27, fontWeight: 700, color: c, lineHeight: 1 }}>{value}</span>
        <span className="eyebrow" style={{ fontSize: 10, marginTop: 3 }}>D-SCORE</span>
      </div>
    </div>
  );
}

/* 신호 강도 도트 */
function GSignal({ value, dots = 5 }) {
  const on = Math.round((value / 100) * dots);
  return <span style={{ display: 'inline-flex', gap: 4 }} title={`신호 강도 ${value}`}>
    {Array.from({ length: dots }).map((_, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: i < on ? 'var(--g-brand)' : 'var(--line)' }} />)}
  </span>;
}

/* 시계열 라인차트 (신호 강도 추이 등) — 컨테이너 폭에 맞춰 정확한 px로 그림 */
function GTrend({ data, color = 'var(--g-brand)', h = 132 }) {
  const ref = useRef(null);
  const [w, setW] = useState(560);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver((e) => setW(Math.max(220, e[0].contentRect.width)));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  if (!data || data.length < 2)
    return <div ref={ref} className="tx-3" style={{ fontSize: 12.5, padding: '14px 0' }}>추이 데이터가 부족합니다.</div>;

  const padL = 8, padR = 12, padT = 16, padB = 22;
  const vals = data.map((d) => d.score);
  const mn = Math.min(...vals), mx = Math.max(...vals), range = (mx - mn) || 1;
  const X = (i) => padL + (i / (data.length - 1)) * (w - padL - padR);
  const Y = (v) => padT + (1 - (v - mn) / range) * (h - padT - padB);
  const line = data.map((d, i) => `${X(i)},${Y(d.score)}`).join(' ');
  const area = `${X(0)},${h - padB} ${line} ${X(data.length - 1)},${h - padB}`;
  const fmt = (iso) => { const d = new Date(iso); return `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const step = Math.max(1, Math.ceil(data.length / 5));
  const last = data[data.length - 1];

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
        <polygon points={area} fill={color} opacity="0.10" />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={i} cx={X(i)} cy={Y(d.score)} r={i === data.length - 1 ? 4 : 2.4} fill={color} />
        ))}
        {data.map((d, i) => (i % step === 0 || i === data.length - 1) ? (
          <text key={'t' + i} x={X(i)} y={h - 6} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--tx-3)', fontFamily: 'DM Mono, monospace' }}>{fmt(d.date)}</text>
        ) : null)}
        <text x={X(data.length - 1)} y={Y(last.score) - 9} textAnchor="end" style={{ fontSize: 11.5, fontWeight: 700, fill: color, fontFamily: 'DM Mono, monospace' }}>{last.score}</text>
      </svg>
    </div>
  );
}

function gRel(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (d < 1) return Math.max(1, Math.round(d * 60)) + '분 전';
  if (d < 24) return Math.round(d) + '시간 전';
  return Math.round(d / 24) + '일 전';
}

/* 카운트업 */
function useCount(target, dur = 700) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf, s; const tick = (t) => { if (!s) s = t; const p = Math.min(1, (t - s) / dur); setN(Math.round((1 - Math.pow(1 - p, 3)) * target)); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    // 폴백: rAF가 멈춘(백그라운드 탭 등) 경우에도 최종값 보장
    const fb = setTimeout(() => setN(target), dur + 150);
    return () => { cancelAnimationFrame(raf); clearTimeout(fb); };
  }, [target]);
  return n;
}

window.G = { GG, gColor, gSoft, GLOSSARY, Term, GIcon, GPill, GScoreBar, GDonut, GSignal, GTrend, gRel, useCount };
