import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchCompany, fetchSignals, fetchCompanyDisclosures } from "../api";
import { useAuth } from "../useAuth";
import { canSee } from "../permissions";
import { Icon, Term } from "../components/guide";
import { pct } from "../lib/adapt";

const dzFmt = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

export default function CompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role!;

  const [company, setCompany] = useState<any>(null);
  const [signals, setSignals] = useState<any[]>([]);
  const [disclosures, setDisclosures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetchCompany(id!).then(setCompany).catch((e: any) => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchCompanyDisclosures(id!, { limit: 50 }).then(setDisclosures).catch(() => setDisclosures([]));
  }, [id]);

  useEffect(() => {
    if (!company?.corp_code) return;
    fetchSignals({ corp_code: company.corp_code, limit: 100 }).then(setSignals).catch(() => setSignals([]));
  }, [company?.corp_code]);

  if (loading) {
    return <div className="g-pad"><div className="g-card g-card-pad" style={{ height: 120 }} /></div>;
  }
  if (error || !company) {
    return (
      <div className="g-pad">
        <button className="g-btn ghost" style={{ marginBottom: 14, paddingLeft: 0 }} onClick={() => navigate(-1)}><Icon name="chevron-left" size={18} /> 뒤로</button>
        <div className="g-card g-card-pad tx-3" style={{ textAlign: "center", padding: 40 }}>{error ?? "기업을 찾을 수 없습니다."}</div>
      </div>
    );
  }

  const latest = signals[0];
  const signalPct = pct(latest?.s_score);

  return (
    <div className="g-pad g-up">
      <button className="g-btn ghost" style={{ marginBottom: 14, paddingLeft: 0, color: "var(--tx-2)" }} onClick={() => navigate(-1)}>
        <Icon name="chevron-left" size={18} /> 뒤로
      </button>

      {/* 헤더 */}
      <div className="g-card g-card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <span className="g-chip" style={{ cursor: "default", padding: "4px 11px", fontSize: 12 }}>{company.is_listed ? "상장사" : "비상장"}</span>
              {company.is_anchor && <span className="g-pill" style={{ color: "var(--brand-tx)", background: "var(--g-brand-soft)" }}><span className="d" style={{ background: "var(--g-brand)" }} />대기업(앵커)</span>}
            </div>
            <h1 className="g-head" style={{ fontSize: 24, margin: 0 }}>{company.corp_name}</h1>
            <div className="tx-2" style={{ fontSize: 13.5, marginTop: 5 }}>{company.sector ?? "-"}{company.corp_code ? ` · ${company.corp_code}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canSee("networkButton", role) && (
              <button className="g-btn" onClick={() => navigate(`/network/${id}`)}><Icon name="network" size={17} /> 공급망 보기</button>
            )}
            {canSee("reportButton", role) && (
              <button className="g-btn primary" onClick={() => navigate(`/report/${id}`)}><Icon name="doc" size={17} /> 리포트 생성</button>
            )}
          </div>
        </div>
      </div>

      {/* 점수 카드 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="g-grid-2">
        {/* 신호 강도 (실데이터) */}
        <div className="g-card g-card-pad">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 className="g-head" style={{ fontSize: 15, margin: 0, display: "flex", alignItems: "center", gap: 8 }}><Icon name="spark" size={17} /> 최신 공시 <Term k="신호 강도">신호 강도</Term></h3>
            <span className="tnum g-mono tx-2" style={{ fontSize: 13 }}>S = {latest?.s_score != null ? Number(latest.s_score).toFixed(2) : "-"}</span>
          </div>
          <div className="g-scorebar" style={{ height: 10, marginBottom: 8 }}>
            <i style={{ width: `${signalPct}%`, background: "var(--g-brand)", transition: "width .8s var(--g-ease)" }} />
          </div>
          <div className="tx-3" style={{ fontSize: 12 }}>
            {latest?.rcept_dt ? `${dzFmt(latest.rcept_dt)} 공시 기준` : "신호 데이터 없음"}
            {signals.length > 0 && ` · 누적 ${signals.length}건`}
          </div>
        </div>

        {/* D-Score (AI-B 대기) */}
        <div className="g-card g-card-pad">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 className="g-head" style={{ fontSize: 15, margin: 0 }}><Term k="D-Score">D-Score</Term></h3>
            <span className="tx-3" style={{ fontSize: 12 }}>AI-B 대기</span>
          </div>
          <div className="g-scorebar" style={{ height: 10, marginBottom: 8 }} />
          <div className="tx-3" style={{ fontSize: 12 }}>AI-B의 D-Score 산출 결과 대기 중</div>
        </div>
      </div>

      {/* 행동 지표 (피처) — AI-B 대기 */}
      <div className="g-card" style={{ marginBottom: 16 }}>
        <div className="g-card-hd"><Icon name="chart" size={18} /><h3>행동 지표 7가지</h3><span className="tx-3" style={{ marginLeft: "auto", fontSize: 12 }}>특허·R&D·발명자 등</span></div>
        <div className="g-card-pad tx-3" style={{ textAlign: "center", fontSize: 13, padding: "32px 24px" }}>
          AI-B의 피처 산출 결과가 들어오면 막대그래프로 표시됩니다.
        </div>
      </div>

      {/* 최근 공시 (실데이터) */}
      <div className="g-card">
        <div className="g-card-hd"><Icon name="doc" size={18} /><h3>최근 공시</h3><span className="g-mono tx-3" style={{ marginLeft: "auto", fontSize: 12.5 }}>{disclosures.length}건</span></div>
        {disclosures.length === 0 ? (
          <div className="g-card-pad tx-3" style={{ fontSize: 13, textAlign: "center" }}>등록된 공시가 없습니다.</div>
        ) : (
          <div>
            {disclosures.map((d) => (
              <button
                key={d.id}
                onClick={() => navigate(`/disclosure/${encodeURIComponent(d.id)}`)}
                className="g-hoverrow"
                style={{ display: "flex", width: "100%", textAlign: "left", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 24px", borderBottom: "1px solid var(--line-2)", background: "transparent", border: "none", borderBottomWidth: 1, borderBottomStyle: "solid", cursor: "pointer" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                  <div className="tx-3" style={{ fontSize: 12, marginTop: 3 }}>{dzFmt(d.rcept_dt)}{d.chunk_count != null ? ` · ${d.chunk_count}개 섹션` : ""}</div>
                </div>
                {d.s_score != null && (
                  <span className="g-pill" style={{ flex: "none", color: "var(--brand-tx)", background: "var(--g-brand-soft)" }}>신호 {Number(d.s_score).toFixed(2)}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
