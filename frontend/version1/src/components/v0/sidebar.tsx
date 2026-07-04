import { cn } from "../../lib/utils"
import { 
  LayoutDashboard, 
  Network, 
  Search, 
  BarChart3, 
  Lock,
  User
} from "lucide-react"

interface SidebarProps {
  activeScreen: string
  onNavigate: (screen: string) => void
}

const navItems = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard, locked: false },
  { id: "network", label: "공급망 시각화", icon: Network, locked: false },
  { id: "reverse", label: "역방향 조회", icon: Search, locked: true },
  { id: "validation", label: "백테스팅 결과", icon: BarChart3, locked: true },
]

export function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  return (
    <aside className="w-[220px] flex-shrink-0 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">C</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">CashMap × ADE</h1>
            <p className="text-xs text-muted-foreground">선제 여신 인텔리전스</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3">
        <div className="space-y-1 px-3">
          {navItems.slice(0, 2).map((item) => (
            <button
              key={item.id}
              onClick={() => !item.locked && onNavigate(item.id)}
              disabled={item.locked}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                activeScreen === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                item.locked && "opacity-50 cursor-not-allowed"
              )}
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.locked && <Lock className="w-3 h-3 opacity-60" />}
            </button>
          ))}
        </div>

        <div className="h-px bg-border mx-4 my-3" />

        <div className="space-y-1 px-3">
          {navItems.slice(2).map((item) => (
            <button
              key={item.id}
              onClick={() => !item.locked && onNavigate(item.id)}
              disabled={item.locked}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                activeScreen === item.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                item.locked && "opacity-50 cursor-not-allowed"
              )}
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.locked && <Lock className="w-3 h-3 opacity-60" />}
            </button>
          ))}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-info-muted flex items-center justify-center">
            <span className="text-sm font-medium text-info">KJ</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">김준혁 RM</p>
            <p className="text-xs text-muted-foreground truncate">기업금융팀</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
