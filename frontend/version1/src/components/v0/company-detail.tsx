import { ChevronLeft, FileText, Download } from "lucide-react"
import { cn } from "../../lib/utils"

interface CompanyDetailProps {
  onBack: () => void
  onGenerateReport: () => void
}

const featureData = [
  { name: "살아있는 특허 수", value: "47건", percentage: 88 },
  { name: "특허 기술 다각화", value: "H=2.3", percentage: 72 },
  { name: "R&D 투자 비중", value: "8.2%", percentage: 80 },
  { name: "R&D 투자 YoY", value: "+22%", percentage: 65, isBlue: true },
  { name: "발명자 수 YoY", value: "+14%", percentage: 58, isBlue: true },
  { name: "영업이익률 추이", value: "+1.2°", percentage: 55, isBlue: true },
]

export function CompanyDetail({ onBack, onGenerateReport }: CompanyDetailProps) {
  return (
    <div className="flex flex-col gap-4 p-5 overflow-y-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft className="w-4 h-4" />
        대시보드
      </button>

      {/* Company header */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">(주)피에스케이</h1>
            <p className="text-sm text-muted-foreground mt-1">
              반도체 장비 · 코스닥 상장 · 삼성전자 1차 협력사
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm px-4 py-2 rounded-lg bg-success-muted text-success font-medium">
              숨은 진주
            </span>
            <button
              onClick={onGenerateReport}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-border bg-card hover:bg-secondary transition-colors"
            >
              <FileText className="w-4 h-4" />
              리포트 생성
            </button>
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">D-Score</h3>
            <span className="text-sm text-muted-foreground">0.91 / 1.00</span>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden mb-2">
            <div className="h-full bg-success rounded-full" style={{ width: "91%" }} />
          </div>
          <p className="text-xs text-muted-foreground">{"상위 5% 구간 · 행동 점수 > 텍스트 점수"}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">공시 텍스트 의지 점수</h3>
            <span className="text-sm text-muted-foreground">S = 0.82</span>
          </div>
          <div className="h-3 bg-secondary rounded-full overflow-hidden mb-2">
            <div className="h-full bg-info rounded-full" style={{ width: "82%" }} />
          </div>
          <p className="text-xs text-muted-foreground">설비투자 확대 · 신규수주 언어 패턴 탐지</p>
        </div>
      </div>

      {/* Feature contributions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">피처별 D-Score 기여도</h3>
        <div className="space-y-4">
          {featureData.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground w-36 flex-shrink-0">{feature.name}</span>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    feature.isBlue ? "bg-info" : "bg-success"
                  )}
                  style={{ width: `${feature.percentage}%` }}
                />
              </div>
              <span className="text-sm font-medium text-foreground w-12 text-right flex-shrink-0">
                {feature.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
