import { useState, useEffect } from 'react'

const TODAY = new Date().toISOString().slice(0, 10)
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysBetween(a, b) {
  if (!a || !b) return null
  return Math.floor((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)
}

// ── Hardcoded fallback data ─────────────────────────────────────────────

const CCY_SYMBOLS = { USD: '$', EUR: '€', CAD: 'C$', GBP: '£', CHF: 'CHF ' }
function ccySym(currency) {
  return CCY_SYMBOLS[currency] || (currency ? currency + ' ' : '$')
}

const FX_TO_USD = { USD: 1, EUR: 1.08, CAD: 0.73, GBP: 1.27, CHF: 1.13 }
function toUSD(amount, currency) {
  return amount * (FX_TO_USD[currency] || 1)
}

const defaultLongPositions = [
  { ticker: 'FTNT', status: 'open', entryPrice: 84.46, quantity: 10, openDate: '2026-01-12' },
  { ticker: 'ANET', status: 'open', entryPrice: 148.83, quantity: 20, openDate: '2026-01-29' },
  { ticker: 'SOFI', status: 'open', entryPrice: 23.17, quantity: 100, openDate: '2026-01-30' },
  { ticker: 'RDDT', status: 'open', entryPrice: 181.30, quantity: 3, openDate: '2026-02-03' },
  { ticker: 'ENVA', status: 'open', entryPrice: 156, quantity: 5, openDate: '2026-02-10' },
  { ticker: 'CEG', status: 'open', entryPrice: 280.17, quantity: 2, openDate: '2026-02-12', profitPercent: 5.04, unrealizedPnL: 91.79 },
  { ticker: 'CEG', status: 'open', entryPrice: 310.77, quantity: 2, openDate: '2026-02-12' },
  { ticker: 'THM', status: 'open', entryPrice: 2.29, quantity: 100, openDate: '2026-02-17', profitPercent: 7.41, unrealizedPnL: 63.37 },
  { ticker: 'RIG', status: 'open', entryPrice: 6.15, quantity: 100, openDate: '2026-02-17' },
  { ticker: 'ZBIO', status: 'open', entryPrice: 27.41, quantity: 15, openDate: '2026-02-17' },
  { ticker: 'ALAB', status: 'open', entryPrice: 101.62, quantity: 8, openDate: '2026-02-17' },
  { ticker: 'RIG', status: 'open', entryPrice: 6.14, quantity: 100, openDate: '2026-02-20' },
  { ticker: 'ZBIO', status: 'open', entryPrice: 27.52, quantity: 15, openDate: '2026-02-20' },
  { ticker: 'ENVA', status: 'open', entryPrice: 138, quantity: 5, openDate: '2026-02-23' },
  { ticker: 'DASH', status: 'open', entryPrice: 164.14, quantity: 2, openDate: '2026-02-24' },
  { ticker: 'NU', status: 'open', entryPrice: 16.53, quantity: 20, openDate: '2026-02-24' },
  { ticker: 'TLN', status: 'open', entryPrice: 373.26, quantity: 2, openDate: '2026-02-24' },
  { ticker: 'DASH', status: 'open', entryPrice: 174.35, quantity: 2, openDate: '2026-02-25' },
  { ticker: 'THM', status: 'open', entryPrice: 2.93, quantity: 100, openDate: '2026-02-25' },
  { ticker: 'BLCO', status: 'open', entryPrice: 18.59, quantity: 40, openDate: '2026-02-25' },
  { ticker: 'NU', status: 'open', entryPrice: 15.88, quantity: 20, openDate: '2026-02-26' },
  { ticker: 'LRCX', status: 'open', entryPrice: 238.63, quantity: 2, openDate: '2026-02-26' },
  { ticker: 'SITM', status: 'open', entryPrice: 408.60, quantity: 1, openDate: '2026-03-02' },
  { ticker: 'CEG', status: 'open', entryPrice: 319.18, quantity: 2, openDate: '2026-03-03' },
  { ticker: 'NOW', status: 'open', entryPrice: 108.53, quantity: 10, openDate: '2026-03-03', profitPercent: 14.5, unrealizedPnL: 157.03 },
  { ticker: 'MELI', status: 'open', entryPrice: 1652, quantity: 1, openDate: '2026-03-03', profitPercent: 7.94, unrealizedPnL: 131.25 },
  { ticker: 'THM', status: 'open', entryPrice: 3.32, quantity: 100, openDate: '2026-03-03' },
  { ticker: 'PINS', status: 'open', entryPrice: 19.10, quantity: 30, openDate: '2026-03-03' },
  { ticker: 'LRMR', status: 'open', entryPrice: 5.30, quantity: 100, openDate: '2026-03-03' },
  { ticker: 'ARRY', status: 'open', entryPrice: 7.29, quantity: 100, openDate: '2026-03-03' },
  { ticker: 'AU', status: 'open', entryPrice: 115, quantity: 5, openDate: '2026-03-03' },
  { ticker: 'AU', status: 'open', entryPrice: 115.55, quantity: 5, openDate: '2026-03-03' },
  { ticker: 'SITM', status: 'open', entryPrice: 410, quantity: 1, openDate: '2026-03-03' },
  { ticker: 'OKTA', status: 'open', entryPrice: 71.73, quantity: 10, openDate: '2026-03-04', profitPercent: 12.6, unrealizedPnL: 90.65 },
  { ticker: 'BTCE', status: 'open', entryPrice: 55.98, quantity: 100, openDate: '2026-03-04' },
  { ticker: 'COHR', status: 'open', entryPrice: 255.17, quantity: 2, openDate: '2026-03-05' },
  { ticker: 'COHR', status: 'open', entryPrice: 248.19, quantity: 3, openDate: '2026-03-07' },
  { ticker: 'IREN', status: 'open', entryPrice: 38.87, quantity: 15, openDate: '2026-03-05' },
  { ticker: 'GE', status: 'open', entryPrice: 325.78, quantity: 1, openDate: '2026-03-05' },
  { ticker: 'OKLO', status: 'open', entryPrice: 63.03, quantity: 10, openDate: '2026-03-05' },
  { ticker: 'OKLO', status: 'open', entryPrice: 59.04, quantity: 10, openDate: '2026-03-07' },
  { ticker: 'ONDS', status: 'open', entryPrice: 10.86, quantity: 100, openDate: '2026-03-07' },
  { ticker: 'COGT', status: 'open', entryPrice: 38.58, quantity: 35, openDate: '2026-03-07' },
  { ticker: 'SNDK', status: 'open', entryPrice: 542.17, quantity: 2, openDate: '2026-03-07' },
  { ticker: 'ORCL', status: 'open', entryPrice: 153.06, quantity: 4, openDate: '2026-03-07' },
  { ticker: 'STRL', status: 'open', entryPrice: 413.19, quantity: 3, openDate: '2026-03-07' },
  { ticker: 'BTCWEUR', status: 'open', entryPrice: 15.04, quantity: 100, openDate: '2026-03-07', currency: 'EUR' },
  { ticker: 'WHR', status: 'open', entryPrice: 59.12, quantity: 2, openDate: '2026-03-07' },
  { ticker: 'CIEN', status: 'open', entryPrice: 284.28, quantity: 6, openDate: '2026-03-07' },
  { ticker: 'MU', status: 'open', entryPrice: 413.40, quantity: 2, openDate: '2026-03-07' },
  { ticker: 'EUGM', status: 'open', entryPrice: 0, quantity: 750, openDate: '2026-03-07', currency: 'CAD' },
  { ticker: 'AMAT', status: 'open', entryPrice: 328.17, quantity: 2, openDate: '2026-03-07' },
  { ticker: 'HYMC', status: 'open', entryPrice: 40.20, quantity: 10, openDate: '2026-03-06' },
]

const defaultShortPositions = [
  { ticker: 'LITE', status: 'open', entryPrice: 716.95, quantity: 3, exitPrice: 500, openDate: '2026-02-26' },
  { ticker: 'APP', status: 'open', entryPrice: 447.75, quantity: 6, openDate: '2026-02-26' },
  { ticker: 'CAT', status: 'open', entryPrice: 742, quantity: 1, openDate: '2026-03-02', profitPercent: 8.54, unrealizedPnL: 63.43 },
  { ticker: 'MDB', status: 'open', entryPrice: 239.80, quantity: 2, openDate: '2026-03-03' },
  { ticker: 'MDB', status: 'open', entryPrice: 239.18, quantity: 2, openDate: '2026-03-03' },
  { ticker: 'MDB', status: 'open', entryPrice: 253.35, quantity: 2, openDate: '2026-03-03' },
  { ticker: 'POWL', status: 'open', entryPrice: 521, quantity: 2, openDate: '2026-03-04', profitPercent: 4.07, unrealizedPnL: 62.26 },
  { ticker: 'POWL', status: 'open', entryPrice: 487.26, quantity: 1, openDate: '2026-03-07' },
  { ticker: 'CRDO', status: 'open', entryPrice: 113.93, quantity: 5, openDate: '2026-03-05' },
  { ticker: 'CRWD', status: 'open', entryPrice: 398.61, quantity: 10, openDate: '2026-03-05' },
]

const defaultClosedLongPositions = [
  {
    ticker: 'FCX',
    status: 'closed',
    entryPrice: 64.41,
    quantity: 13,
    exitPrice: 64.60,
    profitPercent: 0.29,
    profitDollar: 2.46,
    fees: 1.05,
    openDate: '2026-01-26',
    closeDate: '2026-02-04',
  },
]

const defaultClosedShortPositions = [
  {
    ticker: 'FCX',
    status: 'closed',
    entryPrice: 67.57,
    quantity: 4,
    exitPrice: 66.47,
    profitPercent: 1.63,
    profitDollar: 4.40,
    fees: 0.70,
    openDate: '2026-02-26',
    closeDate: '2026-03-04',
  },
  {
    ticker: 'HYMC',
    status: 'closed',
    entryPrice: 51.28,
    quantity: 10,
    exitPrice: 47.87,
    profitPercent: 6.65,
    profitDollar: 34.08,
    fees: 1.40,
    openDate: '2026-03-02',
    closeDate: '2026-03-05',
  },
  {
    ticker: 'CCJ',
    status: 'closed',
    entryPrice: 121.49,
    quantity: 4,
    exitPrice: 112.94,
    profitPercent: 7.04,
    profitDollar: 34.20,
    fees: 0.70,
    openDate: '2026-03-02',
    closeDate: '2026-03-05',
  },
]

// ── Calculation helpers (used by Header) ────────────────────────────────

let _longPositions = defaultLongPositions
let _shortPositions = defaultShortPositions
let _closedPositions = [...defaultClosedLongPositions, ...defaultClosedShortPositions]

export function setPositionData({ longPositions, shortPositions, closedLongPositions, closedShortPositions }) {
  _longPositions = longPositions
  _shortPositions = shortPositions || defaultShortPositions
  _closedPositions = [...closedLongPositions, ...closedShortPositions]
}

export function calcCurrentlyInvested() {
  return _longPositions.reduce((sum, p) => sum + toUSD(p.entryPrice * p.quantity, p.currency), 0)
}

export function calcProfit() {
  return _closedPositions.reduce((sum, p) => sum + (p.profitDollar || 0) - (p.fees || 0), 0)
}

export function calcDailyPnL() {
  const allOpen = [..._longPositions, ..._shortPositions].filter(p => p.status === 'open')
  return allOpen.reduce((sum, p) => sum + (p.dailyPnL || 0), 0)
}

// ── Helper: calculate % gain/loss ───────────────────────────────────────

function calcPnlPercent(position, isShort = false) {
  if (position.profitPercent != null && position.profitPercent !== 0) {
    return position.profitPercent
  }
  if (position.status === 'closed' && position.exitPrice && position.entryPrice) {
    const raw = ((position.exitPrice - position.entryPrice) / position.entryPrice) * 100
    return isShort ? -raw : raw
  }
  const totalCost = (position.entryPrice || 0) * (position.quantity || 0)
  if (totalCost > 0) {
    // Use unrealizedPnL, realizedPnL, or profitDollar
    const pnl = position.unrealizedPnL || position.realizedPnL || position.profitDollar
    if (pnl != null) return (pnl / totalCost) * 100
    // Derive from marketValue if available
    if (position.marketValue) return ((position.marketValue - totalCost) / totalCost) * 100
  }
  return null
}

// ── Group into trades ────────────────────────────────────────────────
// A "trade" = positions with same ticker opened on the same date.
// Closed positions are already complete trades — keep as individual cards.

function groupFills(positions) {
  const grouped = {}
  for (const p of positions) {
    const key = `${p.ticker}|${p.openDate || ''}`
    if (!grouped[key]) {
      grouped[key] = {
        ...p,
        _totalCost: p.entryPrice * p.quantity,
        _totalExitCost: (p.exitPrice || 0) * p.quantity,
        _totalQty: p.quantity,
        _totalDailyPnL: p.dailyPnL || 0,
        _totalUnrealizedPnL: p.unrealizedPnL || 0,
        _totalRealizedPnL: p.realizedPnL || 0,
        _totalProfitDollar: p.profitDollar || 0,
        _totalFees: p.fees || 0,
        _totalMarketValue: p.marketValue || 0,
        _hasExit: p.exitPrice != null,
        _hasProfitDollar: p.profitDollar != null,
      }
    } else {
      const g = grouped[key]
      g._totalCost += p.entryPrice * p.quantity
      g._totalExitCost += (p.exitPrice || 0) * p.quantity
      g._totalQty += p.quantity
      g._totalDailyPnL += p.dailyPnL || 0
      g._totalUnrealizedPnL += p.unrealizedPnL || 0
      g._totalRealizedPnL += p.realizedPnL || 0
      g._totalProfitDollar += p.profitDollar || 0
      g._totalFees += p.fees || 0
      g._totalMarketValue += p.marketValue || 0
      if (p.exitPrice != null) g._hasExit = true
      if (p.profitDollar != null) g._hasProfitDollar = true
    }
  }
  return Object.values(grouped).map(g => ({
    ...g,
    entryPrice: g._totalCost / g._totalQty,
    exitPrice: g._hasExit ? g._totalExitCost / g._totalQty : undefined,
    quantity: g._totalQty,
    dailyPnL: g._totalDailyPnL || undefined,
    unrealizedPnL: g._totalUnrealizedPnL || undefined,
    realizedPnL: g._totalRealizedPnL || undefined,
    profitDollar: g._hasProfitDollar ? g._totalProfitDollar : undefined,
    profitPercent: undefined, // recalculated from aggregated values
    fees: g._totalFees || undefined,
    marketValue: g._totalMarketValue || undefined,
  }))
}

function groupIntoTrades(openPositions, closedPositions) {
  return [...groupFills(closedPositions), ...groupFills(openPositions)]
}

// ── Components ──────────────────────────────────────────────────────────

function GlowDot({ color }) {
  const colors = {
    green: 'bg-emerald-400 shadow-emerald-400/60',
    red: 'bg-red-400 shadow-red-400/60',
    pink: 'bg-pink-400 shadow-pink-400/60',
  }
  return (
    <span className="relative flex h-3 w-3 shrink-0">
      <span className={`glow-dot absolute inline-flex h-full w-full rounded-full opacity-75 ${colors[color]}`} />
      <span className={`relative inline-flex h-3 w-3 rounded-full ${colors[color]}`} />
    </span>
  )
}

// ── Sparkline SVG ────────────────────────────────────────────────────────

function Sparkline({ data, width = 200, height = 32 }) {
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
}

// ── Expanded detail panel ────────────────────────────────────────────────

function ExpandedDetail({ ticker, history }) {
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
}

// ── Position card ────────────────────────────────────────────────────────

function PositionRow({ position, type, expanded, onToggle, hidden }) {
  const isLong = type === 'long'
  const isShort = type === 'short'
  const isClosed = position.status === 'closed'
  const sym = ccySym(position.currency)
  const pct = calcPnlPercent(position, isShort)

  const borderColor = isClosed
    ? 'border-blue-500/20 hover:border-blue-500/40'
    : isLong
      ? 'border-emerald-500/20 hover:border-emerald-500/40'
      : 'border-pink-500/20 hover:border-pink-500/40'

  // PnL dollar amount
  const pnlDollar = position.unrealizedPnL || position.realizedPnL || position.profitDollar
    || (currentPrice ? (currentPrice - position.entryPrice) * position.quantity : null)

  // Current market price (derived from marketValue / quantity)
  const currentPrice = !isClosed && position.marketValue && position.quantity
    ? position.marketValue / position.quantity
    : null

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

  return (
    <div
      className={`group cursor-pointer rounded-2xl border bg-slate-900/60 transition-all duration-300 ease-in-out ${borderColor} ${
        hidden ? 'scale-95 opacity-0 max-h-0 overflow-hidden !p-0 !m-0' : 'scale-100 opacity-100'
      } ${expanded ? 'bg-slate-800/60 ring-1 ring-slate-700/50' : ''}`}
    >
      <div
        className="flex items-center gap-3 sm:gap-4 px-4 py-3 sm:px-5 sm:py-4"
        onClick={onToggle}
      >
        {/* Status indicator */}
        {isClosed ? (
          <svg className="h-3 w-3 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <GlowDot color={isLong ? 'green' : 'pink'} />
        )}

        {/* Trade label */}
        <span className={`text-xs font-bold uppercase tracking-wide shrink-0 w-14 ${
          isClosed ? 'text-blue-400' : isLong ? 'text-emerald-400/70' : 'text-pink-400/70'
        }`}>
          {isClosed ? 'Closed' : isLong ? 'Long' : 'Short'}
        </span>

        {/* Ticker + Shares */}
        <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-100 shrink-0">
          {position.ticker}
          <span className="text-xs sm:text-sm font-normal text-slate-400 ml-1.5">
            x{position.quantity}
          </span>
        </span>

        {/* Avg Price + Current Price */}
        <span className="text-sm sm:text-base font-bold text-blue-400 shrink-0">
          {sym}{position.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        {currentPrice != null && (
          <span className="text-sm sm:text-base font-bold text-amber-400 shrink-0">
            {sym}{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}

        {/* PnL badge: % + $ */}
        {(pct !== null || pnlDollar !== null) && (
          <span className={`rounded-md px-2 py-0.5 text-sm font-bold shrink-0 ${(pct ?? 0) >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {pct !== null && <>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</>}
            {pct !== null && pnlDollar !== null && ' '}
            {pnlDollar !== null && <>{pnlDollar >= 0 ? '+' : '-'}{sym}{Math.abs(pnlDollar).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
          </span>
        )}

        {/* Fees badge */}
        {position.fees != null && position.fees > 0 && (
          <span className="rounded-md px-2 py-0.5 text-xs font-bold shrink-0 bg-slate-500/15 text-slate-400">
            fees -{sym}{position.fees.toFixed(2)}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Days holding — right aligned */}
        <span className="text-[11px] text-slate-500 shrink-0 text-right">
          {days !== null ? `opened for ${days}d` : position.openDate ? formatDate(position.openDate) : ''}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <ExpandedDetail ticker={position.ticker} history={history} />
      )}
    </div>
  )
}

function PositionList({ longs, shorts, expandedTicker, onToggleTicker, filter }) {
  const allPositions = [
    ...longs.map(p => ({ ...p, _type: 'long' })),
    ...shorts.map(p => ({ ...p, _type: 'short' })),
  ].filter(p => {
    if (filter === 'long') return p._type === 'long' && p.status !== 'closed'
    if (filter === 'short') return p._type === 'short' && p.status !== 'closed'
    if (filter === 'closed') return p.status === 'closed'
    return true
  }).sort((a, b) => {
    const dateA = a.openDate || ''
    const dateB = b.openDate || ''
    return dateB.localeCompare(dateA) // newest first
  })

  return (
    <div className="flex flex-col gap-2 px-2 sm:px-4">
      {allPositions.map((position, i) => {
        const tradeKey = `${position._type}-${position.ticker}-${position.openDate || i}`
        return (
          <PositionRow
            key={tradeKey}
            position={position}
            type={position._type}
            expanded={expandedTicker === tradeKey}
            hidden={false}
            onToggle={() => onToggleTicker(tradeKey)}
          />
        )
      })}
    </div>
  )
}

// Filter to only include 2026 closed positions
function filterClosed2026(positions) {
  return positions.filter((p) => {
    const date = p.closeDate || p.openDate || ''
    return date.startsWith('2026')
  })
}

function mergePositions(defaults, livePositions) {
  if (!livePositions || livePositions.length === 0) return defaults

  const liveByTicker = {}
  for (const pos of livePositions) {
    if (!liveByTicker[pos.ticker]) liveByTicker[pos.ticker] = []
    liveByTicker[pos.ticker].push(pos)
  }

  const merged = []
  const usedLiveTickers = new Set()

  for (const def of defaults) {
    const liveEntries = liveByTicker[def.ticker]
    if (liveEntries && liveEntries.length > 0) {
      if (!usedLiveTickers.has(def.ticker)) {
        for (const live of liveEntries) {
          merged.push({
            ...def,
            ...live,
            openDate: def.openDate || live.openDate || '',
          })
        }
        usedLiveTickers.add(def.ticker)
      }
    } else {
      merged.push(def)
    }
  }

  for (const [ticker, entries] of Object.entries(liveByTicker)) {
    if (!usedLiveTickers.has(ticker)) {
      merged.push(...entries)
    }
  }

  return merged
}

function Positions({ ibkrData }) {
  const hasLive = ibkrData && (ibkrData.longPositions || ibkrData.shortPositions)

  const longPositions = hasLive
    ? mergePositions(defaultLongPositions, ibkrData.longPositions)
    : defaultLongPositions
  const shortPositions = hasLive
    ? mergePositions(defaultShortPositions, ibkrData.shortPositions)
    : defaultShortPositions

  const liveClosedLong = filterClosed2026(ibkrData?.closedLongPositions || [])
  const liveClosedShort = filterClosed2026(ibkrData?.closedShortPositions || [])
  const closedLongKeys = new Set(liveClosedLong.map(p => `${p.ticker}|${p.openDate}`))
  const closedShortKeys = new Set(liveClosedShort.map(p => `${p.ticker}|${p.openDate}`))
  const closedLongPositions = [
    ...liveClosedLong,
    ...filterClosed2026(defaultClosedLongPositions).filter(p => !closedLongKeys.has(`${p.ticker}|${p.openDate}`)),
  ]
  const closedShortPositions = [
    ...liveClosedShort,
    ...filterClosed2026(defaultClosedShortPositions).filter(p => !closedShortKeys.has(`${p.ticker}|${p.openDate}`)),
  ]

  // Keep the calculation helpers in sync (use raw positions for accuracy)
  setPositionData({ longPositions, shortPositions, closedLongPositions, closedShortPositions })

  // Group into individual trades for display
  const tradeLongs = groupIntoTrades(longPositions, closedLongPositions)
  const tradeShorts = groupIntoTrades(shortPositions, closedShortPositions)

  const [expandedTicker, setExpandedTicker] = useState(null)
  const [filter, setFilter] = useState('all')

  function handleToggleTicker(ticker) {
    setExpandedTicker((prev) => (prev === ticker ? null : ticker))
  }

  const allTrades = [
    ...tradeLongs.map(p => ({ ...p, _type: 'long' })),
    ...tradeShorts.map(p => ({ ...p, _type: 'short' })),
  ]
  const longCount = allTrades.filter(p => p._type === 'long' && p.status !== 'closed').length
  const shortCount = allTrades.filter(p => p._type === 'short' && p.status !== 'closed').length
  const closedCount = allTrades.filter(p => p.status === 'closed').length

  const tabs = [
    { key: 'all', label: 'All', count: allTrades.length },
    { key: 'long', label: 'Long', count: longCount },
    { key: 'short', label: 'Short', count: shortCount },
    { key: 'closed', label: 'Closed', count: closedCount },
  ]

  return (
    <div className="mx-auto max-w-5xl">
      {/* Tab bar */}
      <div className="flex items-center gap-6 border-b border-slate-800 px-4 sm:px-8 mb-3">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`pb-3 pt-4 text-sm font-semibold transition-colors ${
              filter === tab.key
                ? 'border-b-2 border-emerald-400 text-emerald-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label} <span className="text-xs font-normal">{tab.count}</span>
          </button>
        ))}
      </div>

      <PositionList
        longs={tradeLongs}
        shorts={tradeShorts}
        expandedTicker={expandedTicker}
        onToggleTicker={handleToggleTicker}
        filter={filter}
      />
    </div>
  )
}

export default Positions
