import { cn } from "../../lib/utils"
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"

export interface CompanyData {
  rank: number
  name: string
  dscore: number
  grade: "pos" | "neg" | "mon"
  signal: number
  date: string
}

interface DataTableProps {
  data: CompanyData[]
  onRowClick?: (company: CompanyData) => void
}

const gradeConfig = {
  pos: {
    label: "숨은 진주",
    className: "bg-success-muted text-success",
    signalColor: "bg-success",
  },
  neg: {
    label: "거품 경보",
    className: "bg-danger-muted text-danger",
    signalColor: "bg-danger",
  },
  mon: {
    label: "모니터링",
    className: "bg-warning-muted text-warning-foreground",
    signalColor: "bg-warning",
  },
}

export function DataTable({ data, onRowClick }: DataTableProps) {
  const [sortField, setSortField] = useState<"dscore" | "signal" | null>("dscore")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  const handleSort = (field: "dscore" | "signal") => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortField) return 0
    const diff = a[sortField] - b[sortField]
    return sortDir === "asc" ? diff : -diff
  })

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const SortIcon = ({ field }: { field: "dscore" | "signal" }) => {
    if (sortField !== field) {
      return <ChevronUp className="w-3 h-3 opacity-30" />
    }
    return sortDir === "desc" ? (
      <ChevronDown className="w-3 h-3" />
    ) : (
      <ChevronUp className="w-3 h-3" />
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary">
              <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground w-12">#</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">기업명</th>
              <th 
                className="py-3 px-4 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("dscore")}
              >
                <span className="flex items-center gap-1">
                  D-Score <SortIcon field="dscore" />
                </span>
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">등급</th>
              <th 
                className="py-3 px-4 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort("signal")}
              >
                <span className="flex items-center gap-1">
                  신호 강도 <SortIcon field="signal" />
                </span>
              </th>
              <th className="py-3 px-4 text-left text-xs font-medium text-muted-foreground">갱신일</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, idx) => {
              const config = gradeConfig[row.grade]
              return (
                <tr
                  key={row.rank}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-border hover:bg-secondary/50 cursor-pointer transition-colors",
                    idx === paginatedData.length - 1 && "border-b-0"
                  )}
                >
                  <td className="py-3 px-4 text-xs text-muted-foreground">{row.rank}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{row.name}</td>
                  <td className="py-3 px-4 font-semibold text-foreground">{row.dscore.toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <span className={cn("text-xs px-2.5 py-1 rounded-md font-medium", config.className)}>
                      {config.label}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3 min-w-[120px]">
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", config.signalColor)}
                          style={{ width: `${row.signal * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8">{row.signal.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{row.date}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary border-t border-border">
        <span className="text-xs text-muted-foreground">
          {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, sortedData.length)} / {sortedData.length}개
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-border bg-card hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={cn(
                "w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors",
                page === currentPage
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card hover:bg-secondary"
              )}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-border bg-card hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
