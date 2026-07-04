import { Layers } from "lucide-react";
import { cn } from "../lib/utils";

// 카테고리 키 → 한글 라벨 + 색
const CATEGORY_META: Record<string, { label: string; bar: string; text: string }> = {
  capex_positive:    { label: "설비투자 (CapEx)", bar: "bg-info",    text: "text-info" },
  order_positive:    { label: "신규 수주",        bar: "bg-success", text: "text-success" },
  material_positive: { label: "소재·공급",        bar: "bg-warning", text: "text-warning-foreground" },
  negative_signal:   { label: "부정 신호",        bar: "bg-danger",  text: "text-danger" },
};

interface CategoryDetail {
  weight?: number;
  weighted_score?: number;
  top_k_mean_similarity?: number;
  keyword_density_score?: number;
}

interface Props {
  categoryScores?: Record<string, CategoryDetail> | null;
  sScore?: number | null;
}

export function SignalCategoryBreakdown({ categoryScores, sScore }: Props) {
  if (!categoryScores || Object.keys(categoryScores).length === 0) return null;

  const entries = Object.entries(categoryScores);
  // 막대 폭 정규화 기준 — 가중 기여도(weighted_score) 절대값 최대
  const maxAbs = Math.max(
    0.0001,
    ...entries.map(([, v]) => Math.abs(v.weighted_score ?? 0))
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-info" /> 신호 카테고리 분해
        </h3>
        {sScore != null && (
          <span className="text-xs text-muted-foreground">종합 신호 S = {sScore.toFixed(2)}</span>
        )}
      </div>

      <div className="space-y-3">
        {entries.map(([key, v]) => {
          const meta = CATEGORY_META[key] ?? { label: key, bar: "bg-muted-foreground", text: "text-foreground" };
          const contrib = v.weighted_score ?? 0;
          const sim = v.top_k_mean_similarity ?? v.keyword_density_score ?? null;
          const pct = Math.round((Math.abs(contrib) / maxAbs) * 100);
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-28 flex-shrink-0">{meta.label}</span>
              <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", meta.bar)} style={{ width: `${pct}%` }} />
              </div>
              <span className={cn("text-sm font-medium w-12 text-right flex-shrink-0", meta.text)}>
                {contrib >= 0 ? "+" : ""}{contrib.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground w-20 text-right flex-shrink-0 hidden sm:block">
                {v.weight != null ? `w ${v.weight}` : ""}
                {sim != null ? ` · 유사 ${sim.toFixed(2)}` : ""}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-3">
        가중 기여도(막대) = 가중치 × 유사도. AI-A의 CashMap 신호 모델 산출값.
      </p>
    </div>
  );
}
