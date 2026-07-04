import { AlertTriangle } from "lucide-react"

interface AlertItem {
  id: number
  name: string
  description: string
  score: number
}

interface AlertListProps {
  alerts: AlertItem[]
  onItemClick?: (id: number) => void
  onViewAll?: () => void
}

export function AlertList({ alerts, onItemClick, onViewAll }: AlertListProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-danger flex items-center gap-2">
          거품 경보
          <span className="text-xs font-normal text-muted-foreground">{alerts.length}건</span>
        </h3>
      </div>

      <div className="space-y-3">
        {alerts.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            현재 경보가 없습니다. (D-Score 산출 대기)
          </p>
        )}
        {alerts.map((alert) => (
          <div
            key={alert.id}
            onClick={() => onItemClick?.(alert.id)}
            className="flex items-start gap-3 p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-danger-muted flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-danger" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{alert.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
            </div>
            <span className="text-sm font-semibold text-danger">{alert.score.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <button 
        onClick={onViewAll}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-right mt-3 py-1"
      >
        전체 경보 보기 →
      </button>
    </div>
  )
}
