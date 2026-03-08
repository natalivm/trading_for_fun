import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

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

// Tickers to ignore during sync (leftovers, corporate actions, etc.)
const IGNORED_TICKERS = new Set(['EUGM'])

const defaultLongPositions = [
  { ticker: 'FTNT', status: 'open', entryPrice: 84.46, quantity: 10, openDate: '2026-01-12' },
  { ticker: 'ANET', status: 'open', entryPrice: 148.83, quantity: 20, openDate: '2026-01-29', profitPercent: -10.5, unrealizedPnL: -318.67 },
  { ticker: 'SOFI', status: 'open', entryPrice: 23.17, quantity: 100, openDate: '2026-01-30', profitPercent: -19.9, unrealizedPnL: -461.31 },
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
  { ticker: 'COHR', status: 'open', entryPrice: 248.19, quantity: 3, openDate: '2026-03-07' },
  { ticker: 'OKLO', status: 'open', entryPrice: 63.03, quantity: 10, openDate: '2026-03-05' },
  { ticker: 'OKLO', status: 'open', entryPrice: 59.04, quantity: 10, openDate: '2026-03-07' },
  { ticker: 'ONDS', status: 'open', entryPrice: 10.86, quantity: 100, openDate: '2026-01-29', profitPercent: -9.3, unrealizedPnL: -101.00 },
  { ticker: 'COGT', status: 'open', entryPrice: 38.58, quantity: 35, openDate: '2026-01-28', unrealizedPnL: (37.80 - 38.58) * 35, profitPercent: ((37.80 - 38.58) / 38.58) * 100 },
  { ticker: 'SNDK', status: 'open', entryPrice: 542.17, quantity: 2, openDate: '2026-03-06', unrealizedPnL: (522 - 542.17) * 2, profitPercent: ((522 - 542.17) / 542.17) * 100 },
  { ticker: 'ORCL', status: 'open', entryPrice: 153.06, quantity: 4, openDate: '2026-03-06', unrealizedPnL: (152.56 - 153.06) * 4, profitPercent: ((152.56 - 153.06) / 153.06) * 100 },
  { ticker: 'STRL', status: 'open', entryPrice: 413.19, quantity: 3, openDate: '2026-03-04', unrealizedPnL: (391.25 - 413.19) * 3, profitPercent: ((391.25 - 413.19) / 413.19) * 100 },
  { ticker: 'BTCWEUR', status: 'open', entryPrice: 15.04, quantity: 100, openDate: '2026-03-07', currency: 'EUR' },
  { ticker: 'BTCE', status: 'open', entryPrice: 55.98, quantity: 100, openDate: '2026-03-04', unrealizedPnL: (52.39 - 55.98) * 100, profitPercent: ((52.39 - 55.98) / 55.98) * 100 },
  { ticker: 'WHR', status: 'open', entryPrice: 59.12, quantity: 2, openDate: '2026-03-06', unrealizedPnL: (58.90 - 59.12) * 2, profitPercent: ((58.90 - 59.12) / 59.12) * 100 },
  { ticker: 'CIEN', status: 'open', entryPrice: 284.28, quantity: 6, openDate: '2026-03-05', unrealizedPnL: (292.5 - 284.28) * 6, profitPercent: ((292.5 - 284.28) / 284.28) * 100 },
  { ticker: 'MU', status: 'open', entryPrice: 413.40, quantity: 2, openDate: '2026-02-25', unrealizedPnL: (369.17 - 413.40) * 2, profitPercent: ((369.17 - 413.40) / 413.40) * 100 },
  { ticker: 'GE', status: 'open', entryPrice: 325.78, quantity: 1, openDate: '2026-03-05', unrealizedPnL: (322.12 - 325.78) * 1, profitPercent: ((322.12 - 325.78) / 325.78) * 100 },
  { ticker: 'AMAT', status: 'open', entryPrice: 328.17, quantity: 2, openDate: '2026-03-06', unrealizedPnL: (324.74 - 328.17) * 2, profitPercent: ((324.74 - 328.17) / 328.17) * 100 },
  { ticker: 'HYMC', status: 'open', entryPrice: 40.20, quantity: 10, openDate: '2026-03-06', unrealizedPnL: (39.30 - 40.20) * 10, profitPercent: ((39.30 - 40.20) / 40.20) * 100 },
  { ticker: 'COHR', status: 'open', entryPrice: 255.17, quantity: 2, openDate: '2026-03-04', unrealizedPnL: (237.00 - 255.17) * 2, profitPercent: ((237.00 - 255.17) / 255.17) * 100 },
  { ticker: 'IREN', status: 'open', entryPrice: 38.87, quantity: 15, openDate: '2026-03-05', unrealizedPnL: (36.71 - 38.87) * 15, profitPercent: ((36.71 - 38.87) / 38.87) * 100 },
]

const defaultShortPositions = [
  { ticker: 'LITE', status: 'open', entryPrice: 716.95, quantity: 3, exitPrice: 500, openDate: '2026-02-26', profitPercent: 20.8, unrealizedPnL: 446.85 },
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
    ticker: 'ANET',
    status: 'closed',
    entryPrice: 132.68,
    quantity: 30,
    exitPrice: 128.86,
    profitDollar: -114.50,
    openDate: '2026-01-06',
    closeDate: '2026-01-07',
  },
  {
    ticker: 'ANET',
    status: 'closed',
    entryPrice: 130.93,
    quantity: 35,
    exitPrice: 130.01,
    profitDollar: -32.15,
    openDate: '2026-01-07',
    closeDate: '2026-01-20',
  },
  {
    ticker: 'HY9H',
    status: 'closed',
    entryPrice: 510,
    quantity: 1,
    exitPrice: 560,
    profitDollar: 50,
    openDate: '2026-03-04',
    closeDate: '2026-03-04',
    currency: 'EUR',
  },
  {
    ticker: 'SAM',
    status: 'closed',
    entryPrice: 1.2136,
    quantity: 2500,
    exitPrice: 1.0144,
    profitDollar: -466.64,
    fees: 0,
    openDate: '2026-01-30',
    closeDate: '2026-03-07',
    currency: 'CAD',
  },
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
    ticker: 'COHR',
    status: 'closed',
    entryPrice: 298.71,
    quantity: 1,
    exitPrice: 264.85,
    profitDollar: 33.86,
    openDate: '2026-03-02',
    closeDate: '2026-03-04',
  },
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

export function calcMyCapital() {
  // Sum of open long positions only (your own money)
  const closedKeys = new Set(_closedPositions.map(c => `${c.ticker}|${c.openDate}`))
  return _longPositions
    .filter(p => !closedKeys.has(`${p.ticker}|${p.openDate}`))
    .reduce((sum, p) => sum + toUSD(p.entryPrice * p.quantity, p.currency), 0)
}

export function calcCurrentlyInvested() {
  // Sum of all open positions — longs + shorts (total capital deployed)
  const closedKeys = new Set(_closedPositions.map(c => `${c.ticker}|${c.openDate}`))
  const allOpen = [..._longPositions, ..._shortPositions]
  return allOpen
    .filter(p => !closedKeys.has(`${p.ticker}|${p.openDate}`))
    .reduce((sum, p) => sum + toUSD(p.entryPrice * p.quantity, p.currency), 0)
}

export function calcProfit() {
  return _closedPositions.reduce((sum, p) => {
    const pnl = (p.profitDollar || 0) - (p.fees || 0)
    return sum + toUSD(pnl, p.currency)
  }, 0)
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

function PositionRow({ position, type, expanded, onToggle, hidden, isNew }) {
  const isLong = type === 'long'
  const isShort = type === 'short'
  const isClosed = position.status === 'closed'
  const sym = ccySym(position.currency)
  const pct = calcPnlPercent(position, isShort)

  const borderColor = isClosed
    ? (isShort ? 'border-pink-500/20 hover:border-pink-500/40' : 'border-blue-500/20 hover:border-blue-500/40')
    : isLong
      ? 'border-emerald-500/20 hover:border-emerald-500/40'
      : 'border-pink-500/20 hover:border-pink-500/40'

  // Current market price (derived from marketValue / quantity)
  const currentPrice = !isClosed && position.marketValue && position.quantity
    ? position.marketValue / position.quantity
    : null

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

  return (
    <div
      className={`group cursor-pointer rounded-2xl border bg-slate-900/60 transition-all duration-300 ease-in-out ${borderColor} ${
        hidden ? 'scale-95 opacity-0 max-h-0 overflow-hidden !p-0 !m-0' : 'scale-100 opacity-100'
      } ${expanded ? 'bg-slate-800/60 ring-1 ring-slate-700/50' : ''}`}
    >
      <div
        className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-3 sm:px-5 sm:py-4"
        onClick={onToggle}
      >
        {/* Status indicator */}
        {isClosed ? (
          <svg className={`h-3 w-3 shrink-0 ${isShort ? 'text-pink-400' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <GlowDot color={isLong ? 'green' : 'pink'} />
        )}

        {/* Trade label */}
        <span className={`text-xs font-bold uppercase tracking-wide shrink-0 ${
          isClosed
            ? (isShort ? 'text-pink-400' : 'text-blue-400')
            : isLong ? 'text-emerald-400/70' : 'text-pink-400/70'
        }`}>
          {isClosed ? (isShort ? 'Short' : 'Long') : isLong ? 'Long' : 'Short'}
        </span>

        {/* Ticker + Shares */}
        <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-100 shrink-0">
          {position.ticker}
          <span className="text-xs sm:text-sm font-normal text-slate-400 ml-1.5">
            x{position.quantity}
          </span>
        </span>

        {/* NEW badge */}
        {isNew && (
          <span className="rounded-md bg-pink-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-400 shrink-0">
            NEW
          </span>
        )}

        {/* Avg Price + Current/Exit Price */}
        <span className="text-sm sm:text-base font-bold text-blue-400 shrink-0">
          {sym}{position.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        {isClosed && position.exitPrice != null ? (
          <>
            <span className="text-xs text-slate-500 shrink-0">→</span>
            <span className="text-sm sm:text-base font-bold text-amber-400 shrink-0">
              {sym}{position.exitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </>
        ) : currentPrice != null ? (
          <span className="text-sm sm:text-base font-bold text-amber-400 shrink-0">
            {sym}{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ) : null}

        {/* PnL badge */}
        {(pct || pnlDollar) && (
          <span className={`rounded-md px-2 py-0.5 text-xs sm:text-sm font-bold shrink-0 ${(pct ?? 0) >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
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
          {days !== null ? `${days}d` : position.openDate ? formatDate(position.openDate) : ''}
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <ExpandedDetail ticker={position.ticker} history={history} />
      )}
    </div>
  )
}

// ── Portfolio Overview Charts ──────────────────────────────────────────

function ActivityHeatmap({ allTrades }) {
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
}


function CumulativePnLChart({ closedPositions, width = 500, height = 120 }) {
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
  let cumulative = 0
  const points = sorted.map(p => {
    cumulative += toUSD((p.profitDollar || 0) - (p.fees || 0), p.currency)
    return { date: p.closeDate, value: cumulative, ticker: p.ticker }
  })

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
}

function QuickStats({ allTrades, closedPositions }) {
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
}

function PortfolioOverview({ allTrades, closedPositions }) {
  return (
    <div className="flex flex-col gap-7 px-2 sm:px-4">
      <QuickStats allTrades={allTrades} closedPositions={closedPositions} />
      <CumulativePnLChart closedPositions={closedPositions} />
      <ActivityHeatmap allTrades={allTrades} />
    </div>
  )
}

function PositionList({ longs, shorts, expandedTicker, onToggleTicker, filter, newPositionKeys }) {
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
  if (!livePositions || livePositions.length === 0) return defaults.filter(p => !IGNORED_TICKERS.has(p.ticker))

  const liveByTicker = {}
  for (const pos of livePositions) {
    if (IGNORED_TICKERS.has(pos.ticker)) continue
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
          const entry = {
            ...def,
            ...live,
            openDate: def.openDate || live.openDate || '',
          }
          // If live provides marketValue but zero P/L, recalculate from price
          const liveQty = live.quantity || def.quantity || 0
          const liveEntry = live.entryPrice || def.entryPrice || 0
          if (live.marketValue && liveQty && liveEntry) {
            const currentPrice = live.marketValue / liveQty
            if (!live.unrealizedPnL) {
              entry.unrealizedPnL = (currentPrice - liveEntry) * liveQty
            }
            if (!live.profitPercent) {
              entry.profitPercent = ((currentPrice - liveEntry) / liveEntry) * 100
            }
          }
          // Still fall back to manual defaults if nothing else available
          if (!entry.profitPercent && def.profitPercent) entry.profitPercent = def.profitPercent
          if (!entry.unrealizedPnL && def.unrealizedPnL) entry.unrealizedPnL = def.unrealizedPnL
          merged.push(entry)
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
    : defaultLongPositions.filter(p => !IGNORED_TICKERS.has(p.ticker))
  const shortPositions = hasLive
    ? mergePositions(defaultShortPositions, ibkrData.shortPositions)
    : defaultShortPositions.filter(p => !IGNORED_TICKERS.has(p.ticker))

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
    { key: 'overview', label: 'Overview' },
    { key: 'long', label: 'Long', count: longCount },
    { key: 'short', label: 'Short', count: shortCount },
    { key: 'closed', label: 'Closed', count: closedCount },
  ]

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
      className="mx-auto max-w-5xl pb-20"
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
        <div className="mx-auto flex max-w-5xl items-stretch justify-around">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-semibold transition-colors ${
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
