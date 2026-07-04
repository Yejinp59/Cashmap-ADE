import { Bell, RefreshCw } from "lucide-react"

interface TopbarProps {
  title: string
}

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 flex-shrink-0">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-md">
          <RefreshCw className="w-3 h-3" />
          <span>갱신 05.30 09:14</span>
        </div>
        
        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-secondary transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full border-2 border-card" />
        </button>
      </div>
    </header>
  )
}
