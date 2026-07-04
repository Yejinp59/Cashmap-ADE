import { useMemo } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { useSignalTrend } from "../../hooks"

// 회사별 색상 팔레트 (corp_code 등장 순서대로 배정)
const PALETTE = [
  "oklch(0.55 0.18 240)", // 파랑
  "oklch(0.55 0.16 145)", // 초록
  "oklch(0.6 0.18 30)",   // 주황
  "oklch(0.55 0.2 300)",  // 보라
]

type TrendPoint = { date: string; corp_code: string; name: string; score: number }

function fmtDate(d: string) {
  // "2024-11-14" → "24.11"
  const [y, m] = d.split("-")
  return `${y.slice(2)}.${m}`
}

export function SignalChart() {
  const { data, loading, error } = useSignalTrend()

  const { rows, series } = useMemo(() => {
    const points = (data ?? []) as TrendPoint[]
    // 회사 목록(등장 순서)
    const compMap = new Map<string, string>()
    points.forEach((p) => { if (!compMap.has(p.corp_code)) compMap.set(p.corp_code, p.name) })
    const series = Array.from(compMap.entries()).map(([code, name], i) => ({
      code, name, color: PALETTE[i % PALETTE.length],
    }))
    // 날짜별로 피벗 (회사 시점이 겹치지 않으면 해당 칸만 채워짐)
    const byDate = new Map<string, any>()
    points.forEach((p) => {
      const key = p.date
      if (!byDate.has(key)) byDate.set(key, { date: key, label: fmtDate(key) })
      byDate.get(key)[p.corp_code] = p.score
    })
    const rows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
    return { rows, series }
  }, [data])

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">대기업별 신호 강도 추이</h3>
        <span className="text-xs text-muted-foreground">공시 기준 시계열</span>
      </div>

      <div className="h-[160px]">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">로딩 중…</div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-xs text-danger">⚠ {error}</div>
        ) : rows.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">신호 데이터가 없습니다.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.code} id={`grad-${s.code}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "oklch(0.5 0.02 250)" }}
              />
              <YAxis
                domain={[0, 1]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "oklch(0.5 0.02 250)" }}
                tickFormatter={(value) => value.toFixed(1)}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(1 0 0)",
                  border: "1px solid oklch(0.9 0.005 250)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [value.toFixed(2), ""]}
              />
              {series.map((s) => (
                <Area
                  key={s.code}
                  type="monotone"
                  dataKey={s.code}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#grad-${s.code})`}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="flex items-center gap-5 mt-3 flex-wrap">
        {series.map((s) => (
          <div key={s.code} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            <span className="text-xs text-muted-foreground">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
