import { ChevronLeft, FileDown, FileSpreadsheet } from "lucide-react"

interface ReportViewProps {
  onBack: () => void
}

export function ReportView({ onBack }: ReportViewProps) {
  return (
    <div className="flex flex-col gap-4 p-5 overflow-y-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ChevronLeft className="w-4 h-4" />
        기업 상세
      </button>

      {/* Report content */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5 pb-5 border-b border-border">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              (주)피에스케이 — RM 액션 리포트
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              생성일 2025.05.30 · D-Score 기준
            </p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary transition-colors">
              <FileDown className="w-4 h-4" />
              PDF
            </button>
            <button className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary transition-colors">
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">D-Score</p>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">0.91</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-success-muted text-success font-medium">
                숨은 진주
              </span>
            </div>
          </div>
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">살아있는 특허 수</p>
            <span className="font-semibold text-foreground">47건 (최근 3년)</span>
          </div>
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">R&D 투자 비중</p>
            <span className="font-semibold text-foreground">8.2% (매출 대비)</span>
          </div>
          <div className="p-4 bg-secondary rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">신호 강도 S</p>
            <span className="font-semibold text-foreground">0.82 (삼성전자 공시 연동)</span>
          </div>
        </div>

        {/* Recommendation */}
        <div className="p-4 bg-success-muted rounded-lg">
          <p className="text-sm text-success leading-relaxed">
            <strong className="font-semibold">접촉 추천 사유:</strong> 삼성전자 05.28 CapEx 공시 이후 수혜 예상 1차 협력사. 
            특허 47건 유지, R&D 투자 YoY +22%. 말보다 행동이 앞서는 기업. 타행 선점 전 접촉 권장.
          </p>
        </div>
      </div>
    </div>
  )
}
