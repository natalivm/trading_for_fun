import { memo } from 'react'
import { toUSD } from '../../utils/constants'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysBetween(a, b) {
  if (!a || !b) return null
  return Math.floor((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)
}

const ActivityHeatmap = memo(function ActivityHeatmap({ allTrades }) {
  const activityMap = {}
  for (const p of allTrades) {
    if (p.openDate) activityMap[p.openDate] = (activityMap[p.openDate] || 0) + 1
    if (p.closeDate) activityMap[p.closeDate] = (activityMap[p.closeDate] || 0) + 1
  }

  const year = 2026
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  const startDay = new Date(jan1)
  while (startDay.getDay() !== 1) startDay.setDate(startDay.getDate() - 1)
  const endDay = new Date(dec31)
  while (endDay.getDay() !== 5) endDay.setDate(endDay.getDate() + 1)

  const weeks = []
  const cursor = new Date(startDay)
  while (cursor <= endDay) {
    const week = []
    for (let d = 0; d < 5; d++) {
      const dateStr = cursor.toISOString().slice(0, 10)
      const inYear = cursor.getFullYear() === year && cursor >= jan1 && cursor <= dec31
      week.push({ date: dateStr, count: activityMap[dateStr] || 0, inYear })
      cursor.setDate(cursor.getDate() + 1)
    }
    cursor.setDate(cursor.getDate() + 2)
    weeks.push(week)
  }

  const maxCount = Math.max(1, ...Object.values(activityMap))
  const cellSize = 18, gap = 3

  const getColor = (count, inYear) => {
    if (!inYear) return 'transparent'
    if (count === 0) return 'rgba(30,41,59,0.18)'
    const intensity = Math.min(count / maxCount, 1)
    if (intensity <= 0.25) return '#064e3b'
    if (intensity <= 0.5) return '#059669'
    if (intensity <= 0.75) return '#34d399'
    return '#6ee7b7'
  }

  const months = []
  let lastMonth = -1
  for (let w = 0; w < weeks.length; w++) {
    const firstValid = weeks[w].find(d => d.inYear)
    if (firstValid) {
      const m = new Date(firstValid.date).getMonth()
      if (m !== lastMonth) {
        months.push({ label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m], week: w })
        lastMonth = m
      }
    }
  }

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const labelW = 36
  const svgW = weeks.length * (cellSize + gap) + labelW
  const svgH = 5 * (cellSize + gap) + 26

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Trading Activity — {year}</h3>
      <div className="overflow-x-auto">
        <svg width={svgW} height={svgH} className="block">
          {dayLabels.map((label, i) => (
            <text key={i} x={0} y={24 + i * (cellSize + gap) + cellSize / 2 + 1}
              fill="#94a3b8" fontSize="11" fontFamily="system-ui" dominantBaseline="middle">{label}</text>
          ))}
          {months.map(({ label, week }) => (
            <text key={label} x={labelW + week * (cellSize + gap)} y={11}
              fill="#94a3b8" fontSize="11" fontWeight="500" fontFamily="system-ui">{label}</text>
          ))}
          {weeks.map((week, wi) =>
            week.map((day, di) => (
              <rect key={`${wi}-${di}`}
                x={labelW + wi * (cellSize + gap)}
                y={20 + di * (cellSize + gap)}
                width={cellSize} height={cellSize} rx={3}
                fill={getColor(day.count, day.inYear)}
                stroke={day.count > 0 && day.inYear ? 'rgba(52,211,153,0.2)' : 'none'}
                strokeWidth={0.5}
              >
                {day.inYear && <title>{day.date}: {day.count} trade{day.count !== 1 ? 's' : ''}</title>}
              </rect>
            ))
          )}
        </svg>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[11px] text-slate-400">Less</span>
        {['rgba(30,41,59,0.18)', '#064e3b', '#059669', '#34d399', '#6ee7b7'].map((c, i) => (
          <div key={i} className="rounded-sm" style={{ width: cellSize, height: cellSize, background: c }} />
        ))}
        <span className="text-[11px] text-slate-400">More</span>
      </div>
    </div>
  )
})

const CumulativePnLChart = memo(function CumulativePnLChart({ closedPositions, width = 500, height = 120 }) {
  if (!closedPositions || closedPositions.length < 2) {
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Cumulative P&L — Closed Trades</h3>
        <span className="text-[11px] text-slate-600 italic">Need more closed trades to chart</span>
      </div>
    )
  }

  const sorted = [...closedPositions]
    .filter(p => p.closeDate)
    .sort((a, b) => (a.closeDate || '').localeCompare(b.closeDate || ''))
  const points = sorted.reduce((acc, p) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].value : 0
    const value = prev + toUSD((p.profitDollar || 0) - (p.fees || 0), p.currency)
    return [...acc, { date: p.closeDate, value, ticker: p.ticker }]
  }, [])

  const values = points.map(p => p.value)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1
  const padTop = 8, padBottom = 20
  const chartH = height - padTop - padBottom
  const yForVal = v => padTop + chartH - ((v - min) / range) * chartH
  const zeroY = yForVal(0)

  const pathPoints = points.map((p, i) => ({
    x: (i / (points.length - 1)) * width,
    y: yForVal(p.value),
  }))

  const linePath = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${pathPoints[pathPoints.length - 1].x},${zeroY} L${pathPoints[0].x},${zeroY} Z`

  const lastVal = values[values.length - 1]
  const isUp = lastVal >= 0
  const strokeColor = isUp ? '#34d399' : '#f472b6'
  const fillColor = isUp ? 'rgba(52,211,153,0.12)' : 'rgba(244,114,182,0.10)'

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cumulative P&L — Closed Trades</h3>
        <span className="text-sm font-bold tabular-nums" style={{ color: strokeColor }}>
          {lastVal >= 0 ? '+' : '-'}${Math.abs(lastVal).toFixed(0)}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full">
        <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
        <path d={areaPath} fill={fillColor} />
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {pathPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={strokeColor} opacity="0.7" />
        ))}
        <text x="4" y={height - 4} fill="#475569" fontSize="9" fontFamily="monospace">{formatDate(points[0].date)}</text>
        <text x={width - 4} y={height - 4} fill="#475569" fontSize="9" fontFamily="monospace" textAnchor="end">{formatDate(points[points.length - 1].date)}</text>
      </svg>
    </div>
  )
})

const QuickStats = memo(function QuickStats({ allTrades, closedPositions }) {
  const closed = closedPositions.filter(p => p.profitDollar != null)
  const wins = closed.filter(p => (p.profitDollar - (p.fees || 0)) > 0)
  const losses = closed.filter(p => (p.profitDollar - (p.fees || 0)) <= 0)
  const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(0) : '—'

  const best = closed.length > 0
    ? closed.reduce((a, b) => (toUSD(a.profitDollar - (a.fees || 0), a.currency) > toUSD(b.profitDollar - (b.fees || 0), b.currency) ? a : b))
    : null
  const worst = closed.length > 0
    ? closed.reduce((a, b) => (toUSD(a.profitDollar - (a.fees || 0), a.currency) < toUSD(b.profitDollar - (b.fees || 0), b.currency) ? a : b))
    : null

  const holdDays = closed.map(p => daysBetween(p.openDate, p.closeDate)).filter(d => d != null)
  const avgHold = holdDays.length > 0 ? (holdDays.reduce((a, b) => a + b, 0) / holdDays.length).toFixed(0) : '—'

  const openTrades = allTrades.filter(p => p.status !== 'closed')
  const longExposure = openTrades.filter(p => p._type === 'long').reduce((s, p) => s + toUSD(p.entryPrice * p.quantity, p.currency), 0)
  const shortExposure = openTrades.filter(p => p._type === 'short').reduce((s, p) => s + toUSD(p.entryPrice * p.quantity, p.currency), 0)
  const totalExposure = longExposure + shortExposure || 1

  const stats = [
    { label: 'Win Rate', value: `${winRate}%`, sub: `${wins.length}W / ${losses.length}L`, color: 'text-emerald-400' },
    { label: 'Avg Hold', value: `${avgHold}d`, sub: `${closed.length} trades`, color: 'text-blue-400' },
    {
      label: 'Best Trade',
      value: best ? best.ticker : '—',
      sub: best ? `+$${toUSD(best.profitDollar - (best.fees || 0), best.currency).toFixed(0)}` : '',
      color: 'text-emerald-400',
    },
    {
      label: 'Worst Trade',
      value: worst ? worst.ticker : '—',
      sub: worst ? `${toUSD(worst.profitDollar - (worst.fees || 0), worst.currency) >= 0 ? '+' : '-'}$${Math.abs(toUSD(worst.profitDollar - (worst.fees || 0), worst.currency)).toFixed(0)}` : '',
      color: 'text-red-400',
    },
  ]

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Performance Stats</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl bg-slate-800/50 border border-slate-700/30 px-3 py-2.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 block">{s.label}</span>
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            {s.sub && <span className="text-[11px] text-slate-500 ml-1.5">{s.sub}</span>}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          <span>Long ${longExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((longExposure / totalExposure) * 100).toFixed(0)}%)</span>
          <span>Short ${shortExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((shortExposure / totalExposure) * 100).toFixed(0)}%)</span>
        </div>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-800/60">
          <div className="bg-emerald-500/60 rounded-l-full" style={{ width: `${(longExposure / totalExposure) * 100}%` }} />
          <div className="bg-pink-500/60 rounded-r-full" style={{ width: `${(shortExposure / totalExposure) * 100}%` }} />
        </div>
      </div>
    </div>
  )
})

const PortfolioOverview = memo(function PortfolioOverview({ allTrades, closedPositions }) {
  return (
    <div className="flex flex-col gap-7 px-2 sm:px-4">
      <QuickStats allTrades={allTrades} closedPositions={closedPositions} />
      <CumulativePnLChart closedPositions={closedPositions} />
      <ActivityHeatmap allTrades={allTrades} />
    </div>
  )
})

export { ActivityHeatmap, CumulativePnLChart, QuickStats, PortfolioOverview }
