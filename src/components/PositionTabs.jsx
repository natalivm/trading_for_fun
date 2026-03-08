import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { API_BASE } from '../utils/apiClient'
import { ccySym, toUSD } from '../utils/constants'
import { setPositionData, calcPnlPercent } from '../utils/positionCalcs'
import { filterClosed2026, groupIntoTrades } from '../utils/positionFilters'
import { IGNORED_TICKERS, mergePositions } from '../utils/positionMerge'
import {
  defaultLongPositions,
  defaultShortPositions,
  defaultClosedLongPositions,
  defaultClosedShortPositions,
} from '../data/defaultPositions'

const TODAY = new Date().toISOString().slice(0, 10)

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysBetween(a, b) {
  if (!a || !b) return null
  return Math.floor((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)
}

// ── Components ──────────────────────────────────────────────────────────

const GlowDot = memo(function GlowDot({ color }) {
  const colors = {
    green: 'bg-emerald-400 shadow-emerald-400/60',
    red: 'bg-red-400 shadow-red-400/60',
    pink: 'bg-pink-400 shadow-pink-400/60',
    blue: 'bg-blue-400 shadow-blue-400/60',
  }
  return (
    <span className="relative flex h-3 w-3 shrink-0">
      <span className={`glow-dot absolute inline-flex h-full w-full rounded-full opacity-75 ${colors[color]}`} />
      <span className={`relative inline-flex h-3 w-3 rounded-full ${colors[color]}`} />
    </span>
  )
})

// ── Sparkline SVG ────────────────────────────────────────────────────────

const Sparkline = memo(function Sparkline({ data, width = 200, height = 32 }) {
  if (!data || data.length < 2) return null
  const values = data.map(d => d.avg_cost)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const lastVal = values[values.length - 1]
  const firstVal = values[0]
  const color = lastVal >= firstVal ? '#34d399' : '#f87171'

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
})

// ── Expanded detail panel ────────────────────────────────────────────────

const ExpandedDetail = memo(function ExpandedDetail({ history }) {
  if (!history) {
    return (
      <div className="px-4 pb-3 sm:px-5 sm:pb-4">
        <span className="text-[11px] text-slate-600 italic">Loading history...</span>
      </div>
    )
  }

  if (history.length < 2) {
    return (
      <div className="px-4 pb-3 sm:px-5 sm:pb-4">
        <span className="text-[11px] text-slate-600 italic">Not enough snapshots yet — history builds with each IBKR sync</span>
      </div>
    )
  }

  // Compute a fun stat: biggest single-day move
  let biggestMove = 0
  let biggestDate = ''
  for (let i = 1; i < history.length; i++) {
    const move = Math.abs(history[i].avg_cost - history[i - 1].avg_cost)
    if (move > biggestMove) {
      biggestMove = move
      biggestDate = history[i].fetched_at?.slice(0, 10) || ''
    }
  }

  const firstPrice = history[0].avg_cost
  const lastPrice = history[history.length - 1].avg_cost
  const totalChange = lastPrice - firstPrice
  const totalPct = firstPrice ? ((totalChange / firstPrice) * 100).toFixed(1) : '0'

  return (
    <div className="flex items-center gap-4 px-4 pb-3 sm:px-5 sm:pb-4 border-t border-slate-800/40 mt-1 pt-2">
      <Sparkline data={history} width={160} height={28} />
      <span className="text-[11px] text-slate-500">
        {history.length} syncs tracked · avg cost moved {totalChange >= 0 ? '+' : ''}{totalPct}%
        {biggestDate && ` · biggest swing $${biggestMove.toFixed(2)} on ${formatDate(biggestDate)}`}
      </span>
    </div>
  )
})

// ── Position card ────────────────────────────────────────────────────────

const FireIcon = memo(function FireIcon() {
  return (
    <span className="relative flex h-5 w-5 shrink-0 fire-icon">
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="#3B82F6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c0 4.5-5 7-5 11a5 5 0 0 0 10 0c0-4-5-6.5-5-11z" />
        <path d="M12 9c0 2.5-2 4-2 6a2 2 0 0 0 4 0c0-2-2-3.5-2-6z" />
      </svg>
    </span>
  )
})

const PositionRow = memo(function PositionRow({ position, type, expanded, onToggle, hidden, isTopGainer }) {
  const isLong = type === 'long'
  const isShort = type === 'short'
  const isClosed = position.status === 'closed'
  const sym = ccySym(position.currency)
  const pct = calcPnlPercent(position, isShort)

  const borderColor = isShort
    ? 'border-pink-500/20 hover:border-pink-500/40'
    : 'border-blue-500/20 hover:border-blue-500/40'

  // Current market price (derived from marketValue / quantity, or from unrealizedPnL)
  let currentPrice = null
  if (!isClosed && position.quantity) {
    if (position.marketValue) {
      currentPrice = position.marketValue / position.quantity
    } else if (position.unrealizedPnL != null && position.entryPrice) {
      currentPrice = isShort
        ? position.entryPrice - position.unrealizedPnL / position.quantity
        : position.entryPrice + position.unrealizedPnL / position.quantity
    }
  }

  // PnL dollar amount
  const pnlDollar = position.unrealizedPnL || position.realizedPnL || position.profitDollar
    || (currentPrice ? (currentPrice - position.entryPrice) * position.quantity : null)

  // Days holding
  const days = isClosed
    ? daysBetween(position.openDate, position.closeDate)
    : daysBetween(position.openDate, TODAY)

  // History for expanded view
  const [history, setHistory] = useState(null)

  useEffect(() => {
    if (!expanded) return
    let cancelled = false
    fetch(`${API_BASE}/api/history/ticker/${position.ticker}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) setHistory(data) })
      .catch(() => { if (!cancelled) setHistory([]) })
    return () => { cancelled = true }
  }, [expanded, position.ticker])

  const sectionBase = `rounded-xl bg-slate-900/60 px-3 py-2 sm:px-4 sm:py-2.5`
  const displayPrice = isClosed && position.exitPrice != null
    ? position.exitPrice
    : currentPrice

  return (
    <div className={`${hidden ? 'scale-95 opacity-0 max-h-0 overflow-hidden !p-0 !m-0' : 'scale-100 opacity-100'} transition-all duration-300 ease-in-out w-full`}>
      <div>
        {/* 3-section card */}
        <div
          className={`group cursor-pointer rounded-2xl border transition-all duration-300 ease-in-out ${isTopGainer ? 'top-gainer-card border-blue-500 hover:border-blue-400' : borderColor} ${expanded ? 'ring-1 ring-slate-700/50' : ''}`}
          onClick={onToggle}
        >
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-[1px] bg-slate-700/30 rounded-2xl overflow-hidden">
            {/* Section 1: Status + Ticker + Quantity + Date (mobile) */}
            <div className={`${sectionBase} flex flex-col gap-1`}>
              <div className="flex items-center gap-2">
                {isClosed ? (
                  <svg className={`h-3 w-3 shrink-0 ${isShort ? 'text-pink-400' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isTopGainer ? (
                  <FireIcon />
                ) : (
                  <GlowDot color={isLong ? 'blue' : 'pink'} />
                )}
                <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-100 whitespace-nowrap">
                  {position.ticker}
                </span>
                <span className={`text-xs font-normal ${isShort ? 'text-pink-400/70' : 'text-blue-400/70'}`}>
                  x{position.quantity}
                </span>
              </div>
              {/* Date badge - visible on mobile only */}
              <div className="sm:hidden">
                {!isClosed && days !== null && days <= 1 ? (
                  <span className="rounded-md bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-400">
                    NEW
                  </span>
                ) : (
                  <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                    {days !== null ? `${days}d` : position.openDate ? formatDate(position.openDate) : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Section 2: Entry Price → Current/Exit Price + PnL (mobile) */}
            <div className={`${sectionBase} flex flex-col gap-1 whitespace-nowrap`}>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-bold ${isShort ? 'text-pink-400' : 'text-blue-400'}`}>
                  {sym}{position.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {displayPrice != null && (
                  <>
                    <span className="text-xs text-slate-500">→</span>
                    <span className={`text-sm font-bold ${(pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sym}{displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </>
                )}
              </div>
              {/* PnL badge - visible on mobile only */}
              {(pct || pnlDollar) ? (
                <div className="sm:hidden">
                  <span className={`rounded-md px-1.5 py-0.5 text-sm font-bold ${(pct ?? 0) >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {pct !== null && <>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</>}
                    {pct !== null && pnlDollar !== null && ' '}
                    {pnlDollar !== null && <>{pnlDollar >= 0 ? '+' : '-'}{sym}{Math.abs(pnlDollar).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Section 3: PnL + Date - desktop only */}
            <div className={`${sectionBase} hidden sm:flex items-center justify-end gap-2 whitespace-nowrap`}>
              {!isClosed && days !== null && days <= 1 ? (
                <span className="rounded-md bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-400">
                  NEW
                </span>
              ) : (
                <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                  {days !== null ? `${days}d` : position.openDate ? formatDate(position.openDate) : ''}
                </span>
              )}
              {(pct || pnlDollar) ? (
                <span className={`rounded-md px-1.5 py-0.5 text-sm font-bold ${(pct ?? 0) >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {pct !== null && <>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</>}
                  {pct !== null && pnlDollar !== null && ' '}
                  {pnlDollar !== null && <>{pnlDollar >= 0 ? '+' : '-'}{sym}{Math.abs(pnlDollar).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
                </span>
              ) : null}
            </div>
          </div>
        </div>

      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className={`mt-1 rounded-2xl border ${borderColor} bg-slate-900/60 overflow-hidden`}>
          <ExpandedDetail ticker={position.ticker} history={history} />
        </div>
      )}
    </div>
  )
})

// ── Portfolio Overview Charts ──────────────────────────────────────────

const ActivityHeatmap = memo(function ActivityHeatmap({ allTrades }) {
  // Count activity per day: each open or close event counts as 1
  const activityMap = {}
  for (const p of allTrades) {
    if (p.openDate) activityMap[p.openDate] = (activityMap[p.openDate] || 0) + 1
    if (p.closeDate) activityMap[p.closeDate] = (activityMap[p.closeDate] || 0) + 1
  }

  // Build weekday-only (Mon–Fri) grid: Jan 1 – Dec 31
  const year = 2026
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  // Walk to the Monday on or before Jan 1
  const startDay = new Date(jan1)
  while (startDay.getDay() !== 1) startDay.setDate(startDay.getDate() - 1)
  // Walk to the Friday on or after Dec 31
  const endDay = new Date(dec31)
  while (endDay.getDay() !== 5) endDay.setDate(endDay.getDate() + 1)

  const weeks = []
  const cursor = new Date(startDay)
  while (cursor <= endDay) {
    const week = []
    for (let d = 0; d < 5; d++) { // Mon–Fri only
      const dateStr = cursor.toISOString().slice(0, 10)
      const inYear = cursor.getFullYear() === year && cursor >= jan1 && cursor <= dec31
      week.push({ date: dateStr, count: activityMap[dateStr] || 0, inYear })
      cursor.setDate(cursor.getDate() + 1)
    }
    cursor.setDate(cursor.getDate() + 2) // skip Sat & Sun
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

  // Month labels
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
          {/* Day labels */}
          {dayLabels.map((label, i) => (
            <text key={i} x={0} y={24 + i * (cellSize + gap) + cellSize / 2 + 1}
              fill="#94a3b8" fontSize="11" fontFamily="system-ui" dominantBaseline="middle">{label}</text>
          ))}
          {/* Month labels */}
          {months.map(({ label, week }) => (
            <text key={label} x={labelW + week * (cellSize + gap)} y={11}
              fill="#94a3b8" fontSize="11" fontWeight="500" fontFamily="system-ui">{label}</text>
          ))}
          {/* Grid cells */}
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
      {/* Legend */}
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

  // Sort by close date, build cumulative P&L
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
  const padTop = 8
  const padBottom = 20

  const chartH = height - padTop - padBottom
  const yForVal = v => padTop + chartH - ((v - min) / range) * chartH
  const zeroY = yForVal(0)

  const pathPoints = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width
    const y = yForVal(p.value)
    return { x, y }
  })

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
        {/* Zero line */}
        <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
        {/* Area fill */}
        <path d={areaPath} fill={fillColor} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots for each trade */}
        {pathPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={strokeColor} opacity="0.7" />
        ))}
        {/* Labels */}
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

  // Best and worst trade
  const best = closed.length > 0
    ? closed.reduce((a, b) => (toUSD(a.profitDollar - (a.fees || 0), a.currency) > toUSD(b.profitDollar - (b.fees || 0), b.currency) ? a : b))
    : null
  const worst = closed.length > 0
    ? closed.reduce((a, b) => (toUSD(a.profitDollar - (a.fees || 0), a.currency) < toUSD(b.profitDollar - (b.fees || 0), b.currency) ? a : b))
    : null

  // Avg holding period for closed trades
  const holdDays = closed.map(p => daysBetween(p.openDate, p.closeDate)).filter(d => d != null)
  const avgHold = holdDays.length > 0 ? (holdDays.reduce((a, b) => a + b, 0) / holdDays.length).toFixed(0) : '—'

  // Long vs Short exposure
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

      {/* Long vs Short exposure bar */}
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

const PositionList = memo(function PositionList({ longs, shorts, expandedTicker, onToggleTicker, filter, newPositionKeys }) {
  const [showOthers, setShowOthers] = useState(false)
  const allPositions = [
    ...longs.map(p => ({ ...p, _type: 'long' })),
    ...shorts.map(p => ({ ...p, _type: 'short' })),
  ].filter(p => {
    if (filter === 'long') return p._type === 'long' && p.status !== 'closed'
    if (filter === 'short') return p._type === 'short' && p.status !== 'closed'
    if (filter === 'closed') return p.status === 'closed'
    return true
  }).sort((a, b) => {
    const pctA = calcPnlPercent(a, a._type === 'short') ?? 0
    const pctB = calcPnlPercent(b, b._type === 'short') ?? 0
    return pctB - pctA // biggest gainer first, biggest loser last
  })

  // Find the open position with the highest profit
  const topGainerTicker = allPositions.reduce((best, p) => {
    if (p.status === 'closed') return best
    const pct = calcPnlPercent(p, p._type === 'short') ?? 0
    if (pct > 0 && pct > (best.pct ?? 0)) return { key: `${p._type}-${p.ticker}-${p.openDate}`, pct }
    return best
  }, { key: null, pct: 0 }).key

  // For closed tab, split into significant (top 15 by abs PnL%) and others
  const MAX_VISIBLE_CLOSED = 15
  const isClosed = filter === 'closed'
  const canCollapse = isClosed && allPositions.length > MAX_VISIBLE_CLOSED
  const hiddenCount = canCollapse ? allPositions.length - MAX_VISIBLE_CLOSED : 0
  const visiblePositions = canCollapse && !showOthers
    ? (() => {
        // Sort by absolute PnL% descending to pick the most significant trades
        const sorted = [...allPositions].sort((a, b) => {
          const absA = Math.abs(calcPnlPercent(a, a._type === 'short') ?? 0)
          const absB = Math.abs(calcPnlPercent(b, b._type === 'short') ?? 0)
          return absB - absA
        })
        const topSet = new Set(sorted.slice(0, MAX_VISIBLE_CLOSED))
        // Return in original sort order (biggest gainer first)
        return allPositions.filter(p => topSet.has(p))
      })()
    : allPositions

  return (
    <div className="flex flex-col gap-2 px-2 sm:px-4 sm:max-w-3xl sm:mx-auto w-full">
      {visiblePositions.map((position, i) => {
        const tradeKey = `${position._type}-${position.ticker}-${position.openDate || i}`
        const closedPrefix = position.status === 'closed' ? `closed-${position._type}` : position._type
        const newKey = `${closedPrefix}|${position.ticker}|${position.openDate}`
        return (
          <PositionRow
            key={tradeKey}
            position={position}
            type={position._type}
            expanded={expandedTicker === tradeKey}
            hidden={false}
            onToggle={() => onToggleTicker(tradeKey)}
            isNew={newPositionKeys?.has(newKey)}
            isTopGainer={tradeKey === topGainerTicker}
          />
        )
      })}
      {canCollapse && !showOthers && (
        <button
          onClick={() => setShowOthers(true)}
          className="w-full py-3 rounded-xl border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-700/40 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors"
        >
          OTHERS ({hiddenCount} more)
        </button>
      )}
      {canCollapse && showOthers && (
        <button
          onClick={() => setShowOthers(false)}
          className="w-full py-2 rounded-xl border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-700/40 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors"
        >
          Hide others
        </button>
      )}
    </div>
  )
})

function Positions({ ibkrData }) {
  const longPositions = useMemo(() => {
    const hasLive = ibkrData?.longPositions
    return hasLive
      ? mergePositions(defaultLongPositions, ibkrData.longPositions)
      : defaultLongPositions.filter(p => !IGNORED_TICKERS.has(p.ticker))
  }, [ibkrData])

  const shortPositions = useMemo(() => {
    const hasLive = ibkrData?.shortPositions
    return hasLive
      ? mergePositions(defaultShortPositions, ibkrData.shortPositions)
      : defaultShortPositions.filter(p => !IGNORED_TICKERS.has(p.ticker))
  }, [ibkrData])

  const closedLongPositions = useMemo(() => {
    const liveClosedLong = filterClosed2026(ibkrData?.closedLongPositions || [])
    const closedLongKeys = new Set(liveClosedLong.map(p => `${p.ticker}|${p.openDate}`))
    return [
      ...liveClosedLong,
      ...filterClosed2026(defaultClosedLongPositions).filter(p => !closedLongKeys.has(`${p.ticker}|${p.openDate}`)),
    ]
  }, [ibkrData])

  const closedShortPositions = useMemo(() => {
    const liveClosedShort = filterClosed2026(ibkrData?.closedShortPositions || [])
    const closedShortKeys = new Set(liveClosedShort.map(p => `${p.ticker}|${p.openDate}`))
    return [
      ...liveClosedShort,
      ...filterClosed2026(defaultClosedShortPositions).filter(p => !closedShortKeys.has(`${p.ticker}|${p.openDate}`)),
    ]
  }, [ibkrData])

  // Keep the calculation helpers in sync (use raw positions for accuracy)
  useEffect(() => {
    setPositionData({ longPositions, shortPositions, closedLongPositions, closedShortPositions })
  }, [longPositions, shortPositions, closedLongPositions, closedShortPositions])

  // Group into individual trades for display
  const tradeLongs = useMemo(
    () => groupIntoTrades(longPositions, closedLongPositions),
    [longPositions, closedLongPositions]
  )
  const tradeShorts = useMemo(
    () => groupIntoTrades(shortPositions, closedShortPositions),
    [shortPositions, closedShortPositions]
  )

  const allTrades = useMemo(() => [
    ...tradeLongs.map(p => ({ ...p, _type: 'long' })),
    ...tradeShorts.map(p => ({ ...p, _type: 'short' })),
  ], [tradeLongs, tradeShorts])

  const longCount = allTrades.filter(p => p._type === 'long' && p.status !== 'closed').length
  const shortCount = allTrades.filter(p => p._type === 'short' && p.status !== 'closed').length
  const closedCount = allTrades.filter(p => p.status === 'closed').length

  const tabs = useMemo(() => [
    { key: 'overview', label: 'Overview' },
    { key: 'long', label: 'Long', count: longCount },
    { key: 'short', label: 'Short', count: shortCount },
    { key: 'closed', label: 'Closed', count: closedCount },
  ], [longCount, shortCount, closedCount])

  // ── NEW tag tracking ──────────────────────────────────────────────────
  // Compare current position keys against what was stored from the previous
  // page load / sync. Positions not seen before get a pink "NEW" badge.
  // On the next reload or sync, the tag goes away (keys are saved to localStorage).
  const prevKeysRef = useRef(null)
  if (prevKeysRef.current === null) {
    const raw = localStorage.getItem('knownPositionKeys')
    prevKeysRef.current = raw ? new Set(JSON.parse(raw)) : null
  }

  const newPositionKeys = useMemo(() => {
    const allCurrent = [
      ...longPositions.map(p => `long|${p.ticker}|${p.openDate}`),
      ...shortPositions.map(p => `short|${p.ticker}|${p.openDate}`),
      ...closedLongPositions.map(p => `closed-long|${p.ticker}|${p.openDate}`),
      ...closedShortPositions.map(p => `closed-short|${p.ticker}|${p.openDate}`),
    ]
    const prev = prevKeysRef.current
    // Save current keys for the next session
    localStorage.setItem('knownPositionKeys', JSON.stringify(allCurrent))
    // On very first load (no prev data), nothing is "new"
    if (!prev) return new Set()
    return new Set(allCurrent.filter(k => !prev.has(k)))
  }, [longPositions, shortPositions, closedLongPositions, closedShortPositions])

  const [expandedTicker, setExpandedTicker] = useState(null)
  const [filter, setFilter] = useState('overview')
  const contentRef = useRef(null)

  // Scroll to top when switching tabs so cards are visible
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'instant', block: 'start' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [filter])

  const handleToggleTicker = useCallback((ticker) => {
    setExpandedTicker((prev) => (prev === ticker ? null : ticker))
  }, [])

  // ── Swipe navigation between tabs ──────────────────────────────────────
  const touchStart = useRef(null)
  const touchStartY = useRef(null)

  const handleTouchStart = useCallback((e) => {
    touchStart.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback((e) => {
    if (touchStart.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStart.current
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    touchStart.current = null
    touchStartY.current = null

    // Only trigger if horizontal swipe is dominant and exceeds threshold
    if (Math.abs(deltaX) < 50 || Math.abs(deltaY) > Math.abs(deltaX)) return

    const tabKeys = tabs.map(t => t.key)
    const currentIdx = tabKeys.indexOf(filter)
    if (deltaX < 0 && currentIdx < tabKeys.length - 1) {
      setFilter(tabKeys[currentIdx + 1])
    } else if (deltaX > 0 && currentIdx > 0) {
      setFilter(tabKeys[currentIdx - 1])
    }
  }, [filter, tabs])

  return (
    <div
      ref={contentRef}
      className="mx-auto max-w-5xl pb-20 min-h-[calc(100dvh-8rem)]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {filter === 'overview' ? (
        <PortfolioOverview allTrades={allTrades} closedPositions={[...closedLongPositions, ...closedShortPositions]} />
      ) : (
        <PositionList
          longs={tradeLongs}
          shorts={tradeShorts}
          expandedTicker={expandedTicker}
          onToggleTicker={handleToggleTicker}
          filter={filter}
          newPositionKeys={newPositionKeys}
        />
      )}

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl items-stretch justify-around sm:justify-center sm:gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`relative flex flex-1 sm:flex-none flex-col items-center gap-0.5 py-3 sm:px-5 text-xs font-semibold transition-colors ${
                filter === tab.key
                  ? 'text-emerald-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {filter === tab.key && (
                <span className="absolute top-0 h-0.5 w-10 rounded-b bg-emerald-400" />
              )}
              <span className="text-sm">{tab.label}</span>
              {tab.count != null && (
                <span className={`text-[10px] font-normal ${filter === tab.key ? 'text-emerald-400/70' : 'text-slate-600'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default Positions
