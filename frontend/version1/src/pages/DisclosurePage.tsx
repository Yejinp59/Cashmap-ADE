import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Sparkles, FileSearch } from "lucide-react";
import { fetchDisclosure } from "../api";
import { useSimilarDisclosures } from "../hooks";
import { buildHighlightSegments, highlightClass, type Highlight } from "../lib/highlight";
import { SignalCategoryBreakdown } from "../components/signal-category-breakdown";
import { cn } from "../lib/utils";

interface DisclosureDetail {
  id: string;                 // = rcept_no
  rcept_no: string;
  corp_name?: string | null;
  report_type?: string | null;
  title?: string | null;
  content?: string | null;
  signal_score?: number | null;
  category_scores?: Record<string, any> | null;
  highlights?: Highlight[] | null;
  rcept_dt: string;
}

export default function DisclosurePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc]         = useState<DisclosureDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const { data: similar } = useSimilarDisclosures(id!);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchDisclosure(id!)
      .then(setDoc)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-5">
        <div className="bg-card border border-border rounded-xl p-5 animate-pulse h-64" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="p-5">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft className="w-4 h-4" /> 뒤로
        </button>
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "공시를 찾을 수 없습니다."}</p>
        </div>
      </div>
    );
  }

  const highlights = doc.highlights ?? [];
  const segments   = buildHighlightSegments(doc.content ?? "", highlights);
  const hasHighlights = highlights.length > 0;

  return (
    <div className="flex flex-col gap-4 p-5 overflow-y-auto">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ChevronLeft className="w-4 h-4" /> 뒤로
      </button>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h1 className="text-lg font-semibold leading-snug">{doc.title ?? `공시 #${doc.id}`}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {doc.corp_name ? `${doc.corp_name} · ` : ""}공시일 {doc.rcept_dt}
          {doc.signal_score != null && (
            <span className="ml-2">· 문서 신호 강도 S = {doc.signal_score.toFixed(2)}</span>
          )}
        </p>
      </div>

      {/* 신호 카테고리 분해 (category_scores 있을 때만) */}
      <SignalCategoryBreakdown categoryScores={doc.category_scores} sScore={doc.signal_score} />

      {/* 하이라이트 요약 (있을 때만) */}
      {hasHighlights && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-success" />
            <h3 className="text-sm font-semibold">AI가 짚은 핵심 신호 문장 ({highlights.length})</h3>
          </div>
          <ul className="space-y-2">
            {[...highlights].sort((a, b) => b.score - a.score).map((h, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className={cn("mt-0.5 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap", highlightClass(h.score))}>
                  {h.score.toFixed(2)}{h.category ? ` · ${h.category}` : ""}
                </span>
                <span className="text-foreground">{h.sentence}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 본문 */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3">공시 원문</h3>
        {doc.content ? (
          <p className="text-sm leading-7 whitespace-pre-wrap text-foreground">
            {segments.map((seg, i) =>
              seg.highlight ? (
                <mark
                  key={i}
                  title={`신호 강도 ${seg.highlight.score.toFixed(2)}${seg.highlight.category ? ` · ${seg.highlight.category}` : ""}`}
                  className={cn("rounded px-0.5 text-foreground cursor-help", highlightClass(seg.highlight.score))}
                >
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">본문이 없습니다.</p>
        )}

        {!hasHighlights && doc.content && (
          <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
            아직 하이라이트가 없습니다. (AI-A의 신호 문장 분석 결과 대기 중)
          </p>
        )}
      </div>

      {/* 비슷한 공시 (임베딩 유사도) */}
      {similar && similar.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileSearch className="w-4 h-4 text-info" />
            <h3 className="text-sm font-semibold">비슷한 공시</h3>
            <span className="text-xs text-muted-foreground">임베딩 유사도 기준</span>
          </div>
          <ul className="divide-y divide-border">
            {similar.map((s: any) => (
              <li key={s.rcept_no}>
                <button
                  onClick={() => navigate(`/disclosure/${encodeURIComponent(s.rcept_no)}`)}
                  className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-secondary/50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.corp_name}{s.rcept_dt ? ` · ${s.rcept_dt}` : ""}
                      {s.s_score != null ? ` · 신호 ${s.s_score.toFixed(2)}` : ""}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-info-muted text-info font-medium whitespace-nowrap">
                    유사도 {Math.round(s.similarity * 100)}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
