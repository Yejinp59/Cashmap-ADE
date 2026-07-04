/* ============================================================================
 *  3안 역방향 조회  —  친절한 자연어 검색 + 수혜 카드 + 전파 그림
 * ========================================================================== */
function GReverse({ onSelectCompany }) {
  const { GIcon, GPill, Term, gColor } = window.G;
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const examples = ['반도체 장비 발주 증가', '북미 전기차 4680 셀', '페로브스카이트 탠덤 양산', '암모니아 추진 선박', 'ADC 항암 CDMO'];

  const run = (q) => {
    const query = (q ?? text).trim();
    if (!query) return;
    setText(query); setLoading(true); setResult(null);
    Promise.resolve(window.ADE.reverseQuery(query))
      .then((res) => setResult(res))
      .finally(() => setLoading(false));
  };

  return (
    <div className="g-pad g-up">
      <div style={{ marginBottom: 18, maxWidth: 720 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}><Term k="역방향 조회">역방향 조회</Term></div>
        <h1 className="g-head" style={{ fontSize: 24, margin: 0 }}>“이런 일이 생기면 누가 수혜를 볼까?”</h1>
        <p className="tx-2" style={{ fontSize: 14, margin: '8px 0 0' }}>
          산업에서 일어날 일을 평소 말하듯 적어보세요. 수혜가 예상되는 협력사를 순서대로 찾아드립니다. <b>비상장 기업은 프리IPO 후보</b>로도 표시돼요.
        </p>
      </div>

      {/* 검색창 */}
      <div className="g-card g-card-pad" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }}><GIcon name="search" size={19} /></span>
            <input className="g-input" style={{ paddingLeft: 46 }} value={text} placeholder="예) 반도체 장비 발주가 늘면 어떤 협력사가 좋아질까?"
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} autoFocus />
          </div>
          <button className="g-btn primary lg" onClick={() => run()} disabled={loading}>{loading ? '찾는 중…' : '수혜 기업 찾기'}</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="tx-3" style={{ fontSize: 12.5 }}>예시:</span>
          {examples.map((ex) => <button key={ex} className="g-chip" onClick={() => run(ex)}>{ex}</button>)}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 70 }} className="tx-3">AI가 질의에서 키워드를 뽑아 수혜 경로를 따라가는 중…</div>}

      {result && !loading && (
        <div className="g-grid-2 g-up" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(360px,.95fr)', gap: 18, alignItems: 'start' }}>
          <div>
            <div className="g-banner" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
              <span className="b-ic"><GIcon name={result.ai ? 'spark' : 'check'} size={20} /></span>
              <div style={{ fontSize: 13.5, flex: 1, minWidth: 0 }}>
                <b style={{ color: 'var(--brand-tx)' }}>{result.origin.name}</b>의 <b>{result.scenario.title}</b> 흐름에서{' '}
                <span className="tx-2">{result.items.length}개 수혜 후보를 찾았어요.</span>
                {result.keywords && result.keywords.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                    <span className="eyebrow" style={{ fontSize: 10.5 }}>{result.ai ? 'AI가 뽑은 키워드' : '매칭 키워드'}</span>
                    {result.keywords.map((k) => (
                      <span key={k} className="g-chip" style={{ cursor: 'default', padding: '3px 10px', fontSize: 11.5 }}>#{k}</span>
                    ))}
                  </div>
                )}
                {result.rationale && (
                  <div className="tx-3" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>💡 {result.rationale}</div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {result.items.map((it) => (
                <div key={it.id} className="g-card g-hovercard" onClick={() => onSelectCompany(it.id)} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', cursor: 'pointer' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <span className="tnum g-head" style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx-2)' }}>{it.rank}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{it.name}</span>
                      <GPill grade={it.grade} />
                      <span className="g-chip" style={{ cursor: 'default', padding: '2px 9px', fontSize: 11.5 }}>{it.tier}차</span>
                      {!it.listed && <span className="g-pill" style={{ color: 'var(--g-mon)', background: 'var(--g-mon-soft)', fontSize: 11.5 }}>프리IPO 후보</span>}
                    </div>
                    <div className="tx-2" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{it.reason}</div>
                  </div>
                  <div style={{ textAlign: 'center', flex: 'none' }}>
                    <div className="tnum g-head" style={{ fontSize: 24, fontWeight: 700, color: gColor(it.grade) }}>{it.score}</div>
                    <div className="eyebrow" style={{ fontSize: 9.5 }}>수혜점수</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 전파 그림 */}
          <div className="g-card" style={{ position: 'sticky', top: 0 }}>
            <div className="g-card-hd"><GIcon name="network" size={18} /><h3>수혜가 퍼지는 길</h3></div>
            <div className="g-card-pad"><GProp result={result} onSelectCompany={onSelectCompany} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

function GProp({ result, onSelectCompany }) {
  const { gColor } = window.G;
  const W = 460, rowH = 60, pad = 24;
  const H = pad * 2 + result.items.length * rowH;
  const ox = 62, oy = H / 2, tx = W - 110;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {result.items.map((it, i) => {
        const y = pad + i * rowH + rowH / 2, col = gColor(it.grade);
        return <path key={i} d={`M${ox + 16},${oy} C${(ox + tx) / 2},${oy} ${(ox + tx) / 2},${y} ${tx - 14},${y}`} fill="none" stroke={col} strokeWidth="2" strokeOpacity=".4" />;
      })}
      <g transform={`translate(${ox},${oy})`}>
        <rect x="-16" y="-16" width="32" height="32" rx="9" fill="var(--g-brand)" stroke="var(--surface)" strokeWidth="3" />
        <text y="40" textAnchor="middle" style={{ fontFamily: 'Syne, sans-serif', fontSize: 12.5, fontWeight: 700, fill: 'var(--tx)' }}>{result.origin.name}</text>
        <text y="55" textAnchor="middle" style={{ fontFamily: 'DM Mono, monospace', fontSize: 9.5, fill: 'var(--tx-3)' }}>시작점</text>
      </g>
      {result.items.map((it, i) => {
        const y = pad + i * rowH + rowH / 2, col = gColor(it.grade);
        return (
          <g key={it.id} transform={`translate(${tx},${y})`} style={{ cursor: 'pointer' }} onClick={() => onSelectCompany(it.id)}>
            <circle r="13" fill="var(--surface)" stroke={col} strokeWidth="2.6" /><circle r="5.5" fill={col} />
            <text x="22" y="-1" style={{ fontFamily: 'Noto Sans KR, sans-serif', fontSize: 12.5, fontWeight: 600, fill: 'var(--tx)' }}>{it.name}</text>
            <text x="22" y="14" style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fill: 'var(--tx-3)' }}>{it.tier}차 · D-Score {it.dScore}</text>
          </g>
        );
      })}
    </svg>
  );
}

window.GReverse = GReverse;
