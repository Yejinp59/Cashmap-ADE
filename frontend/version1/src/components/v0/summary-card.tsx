import { cn } from "../../lib/utils"

interface SummaryCardProps {
  label: string
  value: number
  description: string
  variant: "success" | "danger" | "info"
  onClick?: () => void
}

export function SummaryCard({ label, value, description, variant, onClick }: SummaryCardProps) {
  const dotColors = {
    success: "bg-success",
    danger: "bg-danger",
    info: "bg-info",
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-xl p-5 transition-all",
        onClick && "cursor-pointer hover:border-primary/30 hover:shadow-sm"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("w-2 h-2 rounded-full", dotColors[variant])} />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-3xl font-semibold text-foreground mb-1">
        {value}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
