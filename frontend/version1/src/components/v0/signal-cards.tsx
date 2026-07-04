import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { useSignalSummary } from "../../hooks";
import { cn } from "../../lib/utils";

const TREND: Record<string, { label: string; cls: string; Icon: typeof ArrowUpRight }> = {
  UP:     { label: "상승", cls: "text-success", Icon: ArrowUpRight },
  DOWN:   { label: "하락", cls: "text-danger",  Icon: ArrowDownRight },
  STABLE: { label: "보합", cls: "text-muted-foreground", Icon: Minus },
};

export function SignalCards() {
  const { data, loading, error } = useSignalSummary();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 animate-pulse h-28" />
        <div className="bg-card border border-border rounded-xl p-5 animate-pulse h-28" />
      </div>
    );
  }
  if (error || !data || data.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((s: any) => {
        const t = TREND[s.trend] ?? TREND.STABLE;
        const pct = Math.round((s.latest_score ?? 0) * 100);
        const clickable = s.company_id != null;
        return (
          <div
            key={s.corp_code}
            onClick={() => clickable && navigate(`/company/${s.company_id}`)}
            className={cn(
              "bg-card border border-border rounded-xl p-5 transition-all",
              clickable && "cursor-pointer hover:border-primary/30 hover:shadow-sm"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">{s.company_name}</span>
              <span className={cn("flex items-center gap-1 text-xs font-medium", t.cls)}>
                <t.Icon className="w-3.5 h-3.5" /> {t.label}
              </span>
            </div>
            <div className="text-2xl font-semibold text-foreground mb-2">
              {s.latest_score?.toFixed(2)}
              <span className="text-sm text-muted-foreground font-normal"> / 1.00</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden mb-1.5">
              <div className="h-full bg-info rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">최신 공시 {s.scored_at} 기준</p>
          </div>
        );
      })}
    </div>
  );
}
