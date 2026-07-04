import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, FileDown, Loader2 } from "lucide-react";
import { fetchReport, downloadReportPdf } from "../api";
import { cn } from "../lib/utils";

const GRADE_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  POSITIVE: { label: "숨은 진주", bg: "bg-success-muted", text: "text-success" },
  NEGATIVE: { label: "거품 경보", bg: "bg-danger-muted",  text: "text-danger" },
  MONITOR:  { label: "모니터링",  bg: "bg-warning-muted", text: "text-warning-foreground" },
};

function fmt(v: any, suffix = "", signed = false): string {
  if (v == null) return "-";
  if (signed)    return `${v > 0 ? "+" : ""}${v}${suffix}`;
  return `${v}${suffix}`;
}

export default function ReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchReport(id!)
      .then(setData)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePdf = async () => {
    setDownloading(true);
    try {
      await downloadReportPdf(id!);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-5">
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
          리포트 데이터를 불러오는 중…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-5">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="w-4 h-4" /> 뒤로
        </button>
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
          <p className="text-sm text-danger mb-2">⚠ {error ?? "리포트를 생성할 수 없습니다."}</p>
          <p className="text-xs text-muted-foreground">
            AI-B의 D-Score 산출 결과가 아직 없을 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  const gs = GRADE_STYLE[data.grade] ?? GRADE_STYLE.MONITOR;
  const generatedAt = data.generated_at
    ? new Date(data.generated_at).toLocaleString("ko-KR", { dateStyle: "long", timeStyle: "short" })
    : "-";

  return (
    <div className="flex flex-col gap-4 p-5 overflow-y-auto">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ChevronLeft className="w-4 h-4" /> 기업 상세
      </button>

      <div className="bg-card border border-border rounded-xl p-5">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5 pb-5 border-b border-border">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {data.corp_name} — RM 액션 리포트
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              생성일 {generatedAt} · D-Score 기준
              {data.is_partial && <span className="ml-2 text-warning-foreground">· 부분 스코어</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePdf}
              disabled={downloading}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {downloading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <FileDown className="w-4 h-4" />}
              {downloading ? "생성 중…" : "PDF 다운로드"}
            </button>
          </div>
        </div>

        {/* 핵심 수치 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">D-Score</p>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-lg">{data.score?.toFixed(2)}</span>
              <span className={cn("text-xs px-2 py-0.5 rounded-md font-medium", gs.bg, gs.text)}>
                {gs.label}
              </span>
            </div>
          </div>
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">살아있는 특허 수</p>
            <span className="font-semibold text-foreground">{fmt(data.patent_count, "건")}</span>
          </div>
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">R&D 투자 비중</p>
            <span className="font-semibold text-foreground">{fmt(data.rd_ratio, "%")} (매출 대비)</span>
          </div>
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">신호 강도 S</p>
            <span className="font-semibold text-foreground">{fmt(data.signal_score)}</span>
          </div>
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">R&D YoY 성장률</p>
            <span className="font-semibold text-foreground">{fmt(data.rd_growth, "%", true)}</span>
          </div>
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">발명자 수 YoY</p>
            <span className="font-semibold text-foreground">{fmt(data.inventor_growth, "%", true)}</span>
          </div>
        </div>

        {/* 추천 사유 */}
        <div className="p-4 bg-success-muted rounded-lg">
          <p className="text-sm text-success leading-relaxed"
             dangerouslySetInnerHTML={{ __html: data.recommendation }} />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        본 리포트는 CashMap × ADE 플랫폼이 자동 생성한 참고 자료이며,
        최종 여신 의사결정은 RM·심사역의 판단을 따릅니다.
      </p>
    </div>
  );
}
