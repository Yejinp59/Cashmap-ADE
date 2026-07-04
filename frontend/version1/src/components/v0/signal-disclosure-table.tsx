import { useNavigate } from "react-router-dom";
import { useSignals } from "../../hooks";
import { cn } from "../../lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  capex_positive:    "설비투자",
  order_positive:    "신규 수주",
  material_positive: "소재·공급",
  negative_signal:   "부정 신호",
};

// 가중 기여도가 가장 큰 (양의) 카테고리
function topCategory(scores?: Record<string, any> | null): string {
  if (!scores) return "-";
  let bestKey = "", best = -Infinity;
  for (const [k, v] of Object.entries(scores)) {
    const w = (v?.weighted_score ?? 0) as number;
    if (w > best) { best = w; bestKey = k; }
  }
  if (best <= 0) return "-";
  return CATEGORY_LABEL[bestKey] ?? bestKey;
}

function scoreColor(s: number): string {
  if (s >= 0.6) return "text-success";
  if (s >= 0.5) return "text-info";
  return "text-muted-foreground";
}

export function SignalDisclosureTable() {
  const { data, loading, error } = useSignals();
  const navigate = useNavigate();

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">최근 신호 공시</h3>
      </div>
      {loading ? (
        <div className="p-8 text-center text-sm text-muted-foreground">로딩 중…</div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-danger">⚠ {error}</div>
      ) : !data || data.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">신호 공시가 없습니다.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              <th className="text-left font-medium px-5 py-2.5">기업</th>
              <th className="text-left font-medium px-5 py-2.5">공시일</th>
              <th className="text-left font-medium px-5 py-2.5 hidden sm:table-cell">핵심 신호</th>
              <th className="text-right font-medium px-5 py-2.5">신호 강도 S</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((s: any) => (
              <tr
                key={s.id}
                onClick={() => navigate(`/disclosure/${encodeURIComponent(s.rcept_no)}`)}
                className="border-b border-border last:border-0 cursor-pointer hover:bg-secondary/50 transition-colors"
              >
                <td className="px-5 py-3 text-foreground">{s.corp_name}</td>
                <td className="px-5 py-3 text-muted-foreground">{s.rcept_dt}</td>
                <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">
                  {topCategory(s.category_scores)}
                </td>
                <td className={cn("px-5 py-3 text-right font-medium", scoreColor(s.s_score ?? 0))}>
                  {s.s_score?.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
