import { cn } from "../../lib/utils"

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="flex border-b border-border bg-card rounded-t-xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "px-5 py-3 text-sm transition-all border-b-2 -mb-px",
            activeTab === tab.id
              ? "text-foreground font-medium border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "ml-2 text-xs px-2 py-0.5 rounded-full",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
