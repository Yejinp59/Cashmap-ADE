import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDScores, useSignalSummary } from "../hooks";
import { useAuth } from "../useAuth";
import { canSee } from "../permissions";
import {
  Icon, Pill, ScoreBar, SignalDots, Term, gColor, useCount, gRel,
  type Grade,
} from "../components/guide";
import { toCongSignals } from "../lib/adapt";

type Filter = "ALL" | Grade;

function StatCard({ icon, grade, brand, label, hint, value, onClick }: {
  icon: string; grade?: Grade; brand?: boolean; label: string; hint: string; value: number; onClick?: () => void;
}) {
  const n = useCount(value);
  const c = brand ? "var(--g-brand)" : gColor(grade!);
  const soft = brand ? "var(--g-brand-soft)" : ({ POSITIVE: "var(--g-pos-soft)", NEGATIVE: "var(--g-neg-soft)", MONITOR: "var(--g-mon-soft)" }[grade!]);
  return (
    <div className="g-card g-stat g-card-pad" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span className="ic-wrap" style={{ background: soft, color: c }}><Icon name={icon} size={22} /></span>
        {onClick && <span className="tx-3" style={{ fontSize: 11.5 }}>모아보기 →</span>}
      </div>
      <div className="v" style={{ color: c }}>{n}</div>
      <div style={{ fontWeight: 600, fontSize: 14.5, marginTop: 8 }}>{label}</div>
      <div className="tx-3" style={{ fontSize: 12.5, marginTop: 2 }}>{hint}</div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role!;

  const [filter, setFilter] = useState<Filter>("ALL");
  const [showGuide, setShowGuide] = useState(true);

  // D-Score (AI-B 대기 → 현재 [])
  const { data: dscores, loading: dsLoading, error: dsError } = useDScores(filter);
  const { data: allDscores } = useDScores("ALL");
  // 대기업 신호 강도 (실데이터)
  const { data: signalSummary } = useSignalSummary();
  const congs = useMemo(() => toCongSignals(signalSummary), [signalSummary]);
  const maxSig = congs.length ? Math.max(...congs.map((c) => c.signal)) : 0;

  const counts = useMemo(() => {
    const arr = allDscores ?? [];
    return {
      pearls: arr.filter((d: any) => d.grade === "POSITIVE").length,
      bubbles: arr.filter((d: any) => d.grade === "NEGATIVE").length,
      monitors: arr.filter((d: any) => d.grade === "MONITOR").length,
    };
  }, [allDscores]);

  const rows = useMemo(() => {
    const arr = (dscores ?? []) as any[];
    return [...arr].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [dscores]);

  const alerts = useMemo(
    () =>
      (allDscores ?? [])
        .filter((d: any) => d.grade === "NEGATIVE")
        .slice(0, 7)
        .map((d: any) => ({
          id: d.company_id,
          name: d.company?.corp_name ?? "-",
          grade: (d.grade as Grade) ?? "NEGATIVE",
          msg: `공시 기대 대비 행동 신호 미달`,
          updatedAt: d.calculated_at ?? new Date().toISOString(),
        })),
    [allDscores]
  );

  const tabs: { key: Filter; label: string; cnt: number }[] = [
    { key: "ALL", label: "전체", cnt: rows.length },
    { key: "POSITIVE", label: "숨은 진주", cnt: counts.pearls },
    { key: "NEGATIVE", label: "거품 경보", cnt: counts.bubbles },
    { key: "MONITOR", label: "모니터링", cnt: counts.monitors },
  ];

  const today = new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });
  const greetName = user?.name || "RM";

  return (
    <div className="g-pad g-up">
      {/* 인사 */}
      <div style={{ marginBottom: 22 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>오늘의 브리핑 · {today}</div>
        <h1 className="g-head" style={{ fontSize: 27, margin: 0 }}>{greetName}님, 살펴볼 신호를 정리했어요</h1>
      </div>

      {/* 가이드 배너 */}
      {showGuide && (
        <div className="g-banner" style={{ marginBottom: 22 }}>
          <span className="b-ic"><Icon name="info" size={21} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 2 }}>처음이신가요? 이렇게 읽어보세요</div>
            <div className="tx-2" style={{ fontSize: 13.5 }}>
              아래 <Term k="D-Score">D-Score</Term>가 높은 <Term k="숨은 진주">숨은 진주</Term>부터 확인하세요. 기업을 클릭하면 자세한 근거가 열립니다. 밑줄 친 단어에 마우스를 올리면 설명이 나와요.
            </div>
          </div>
          <button className="g-btn ghost" onClick={() => setShowGuide(false)} style={{ flex: "none", color: "var(--tx-3)" }}><Icon name="close" size={18} /></button>
        </div>
      )}

      {/* 요약 카드 4 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 22 }} className="g-grid-4">
        {canSee("positiveCard", role) && (
          <StatCard icon="pearl" grade="POSITIVE" label="숨은 진주" hint="지금 선제 영업하기 좋은 기업" value={counts.pearls} onClick={() => setFilter("POSITIVE")} />
        )}
        {canSee("negativeCard", role) && (
          <StatCard icon="alert" grade="NEGATIVE" label="거품 경보" hint="여신 리스크를 살펴볼 기업" value={counts.bubbles} onClick={() => setFilter("NEGATIVE")} />
        )}
        <StatCard icon="eye" grade="MONITOR" label="모니터링" hint="추세를 지켜볼 기업" value={counts.monitors} onClick={() => setFilter("MONITOR")} />
        <StatCard icon="spark" brand label="대기업 신호" hint={`${congs.length}개 대기업 신호 수집`} value={congs.length} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.75fr) minmax(320px,1fr)", gap: 16, alignItems: "start" }} className="g-grid-2">
        {/* 순위 카드 (D-Score) */}
        {canSee("dscoreTable", role) && (
          <div className="g-card">
            <div className="g-card-hd" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="spark" size={18} /><h3>기업 순위</h3>
                <span className="tx-3" style={{ fontSize: 12.5 }}><Term k="D-Score">D-Score</Term> 높은 순</span>
              </div>
              <div className="g-seg">
                {tabs.map((t) => (
                  <button key={t.key} className={filter === t.key ? "on" : ""} onClick={() => setFilter(t.key)}>
                    {t.label}<span className="c">{t.cnt}</span>
                  </button>
                ))}
              </div>
            </div>

            {dsError ? (
              <div className="g-card-pad tx-3" style={{ textAlign: "center", padding: 40, fontSize: 13 }}>⚠ {dsError}</div>
            ) : dsLoading ? (
              <div className="g-card-pad tx-3" style={{ textAlign: "center", padding: 40, fontSize: 13 }}>로딩 중…</div>
            ) : rows.length === 0 ? (
              <div className="g-card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ display: "inline-flex", width: 44, height: 44, borderRadius: 12, background: "var(--bg-soft)", color: "var(--tx-3)", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Icon name="chart" size={22} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>D-Score 산출 대기 중</div>
                <div className="tx-3" style={{ fontSize: 12.5, marginTop: 4 }}>AI-B의 D-Score 결과가 들어오면 이 순위표가 채워집니다.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="g-tbl">
                  <thead><tr>
                    <th>기업</th>
                    <th style={{ width: 210 }}>D-Score</th>
                    <th style={{ width: 120 }}>등급</th>
                    <th style={{ width: 90 }}>신호</th>
                    <th style={{ width: 30 }} />
                  </tr></thead>
                  <tbody>
                    {rows.map((c: any) => {
                      const grade = (c.grade as Grade) ?? "MONITOR";
                      return (
                        <tr key={c.company_id} onClick={() => navigate(`/company/${c.company_id}`)}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{c.company?.corp_name ?? "-"}</div>
                            <div className="tx-3" style={{ fontSize: 12 }}>{c.company?.sector ?? ""}</div>
                          </td>
                          <td><ScoreBar value={Math.round((c.score ?? 0) * (c.score <= 1 ? 100 : 1))} grade={grade} /></td>
                          <td><Pill grade={grade} /></td>
                          <td><SignalDots value={Math.round((c.signal_score ?? 0) * (c.signal_score <= 1 ? 100 : 1))} /></td>
                          <td className="tx-3"><Icon name="chevron" size={16} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 우측 스택 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 대기업 신호 (실데이터) */}
          {canSee("signalPanel", role) && (
            <div className="g-card">
              <div className="g-card-hd">
                <Icon name="spark" size={18} /><h3>대기업 신호</h3>
                <span className="tx-3" style={{ marginLeft: "auto", fontSize: 12 }}><Term k="신호 강도">강도</Term></span>
              </div>
              <div className="g-card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {congs.length === 0 ? (
                  <div className="tx-3" style={{ fontSize: 12.5, textAlign: "center", padding: "12px 0" }}>수집된 대기업 신호가 없습니다.</div>
                ) : (
                  congs.map((cg) => (
                    <div
                      key={cg.id}
                      onClick={() => cg.companyId && navigate(`/company/${cg.companyId}`)}
                      style={{ cursor: cg.companyId ? "pointer" : "default" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{cg.name}</span>
                        <span className="tnum g-mono" style={{ fontSize: 13, color: cg.signal === maxSig ? "var(--brand-tx)" : "var(--tx-3)" }}>{cg.signal}</span>
                      </div>
                      <div className="g-scorebar" style={{ height: 8 }}>
                        <i style={{ width: cg.signal + "%", background: cg.signal === maxSig ? "var(--g-brand)" : "var(--tx-3)" }} />
                      </div>
                      <div className="tx-3" style={{ fontSize: 12, marginTop: 5 }}>{cg.theme}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 살펴볼 알림 */}
          {canSee("alertListPanel", role) && (
            <div className="g-card">
              <div className="g-card-hd">
                <Icon name="alert" size={18} /><h3>살펴볼 알림</h3>
                <span className="g-pill" style={{ marginLeft: "auto", color: "var(--g-neg)", background: "var(--g-neg-soft)" }}>
                  <span className="d" style={{ background: "var(--g-neg)" }} />{alerts.length}건
                </span>
              </div>
              {alerts.length === 0 ? (
                <div className="g-card-pad tx-3" style={{ fontSize: 12.5, textAlign: "center" }}>현재 경보가 없습니다.</div>
              ) : (
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {alerts.map((a) => (
                    <div key={a.id} onClick={() => navigate(`/company/${a.id}`)} className="g-hoverrow" style={{ display: "flex", gap: 12, padding: "14px 22px", borderBottom: "1px solid var(--line-2)", cursor: "pointer" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: gColor(a.grade), flex: "none", marginTop: 6 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.name}</span>
                          <span className="tx-3 g-mono" style={{ fontSize: 11.5, flex: "none" }}>{gRel(a.updatedAt)}</span>
                        </div>
                        <div className="tx-2" style={{ fontSize: 12.5, marginTop: 2 }}>{a.msg}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
