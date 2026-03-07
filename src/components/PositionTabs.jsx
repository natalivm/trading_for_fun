import { useState, useEffect, useRef } from 'react'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
  { ticker: 'CEG', status: 'open', entryPrice: 280.17, quantity: 2, openDate: '2026-02-12' },
  { ticker: 'CEG', status: 'open', entryPrice: 310.77, quantity: 2, openDate: '2026-02-12' },
  { ticker: 'THM', status: 'open', entryPrice: 2.29, quantity: 100, openDate: '2026-02-17' },
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
  { ticker: 'NOW', status: 'open', entryPrice: 108.53, quantity: 10, openDate: '2026-03-03' },
  { ticker: 'MELI', status: 'open', entryPrice: 1652, quantity: 1, openDate: '2026-03-03' },
  { ticker: 'THM', status: 'open', entryPrice: 3.32, quantity: 100, openDate: '2026-03-03' },
  { ticker: 'PINS', status: 'open', entryPrice: 19.10, quantity: 30, openDate: '2026-03-03' },
  { ticker: 'LRMR', status: 'open', entryPrice: 5.30, quantity: 100, openDate: '2026-03-03' },
  { ticker: 'ARRY', status: 'open', entryPrice: 7.29, quantity: 100, openDate: '2026-03-03' },
  { ticker: 'AU', status: 'open', entryPrice: 115, quantity: 5, openDate: '2026-03-03' },
  { ticker: 'AU', status: 'open', entryPrice: 115.55, quantity: 5, openDate: '2026-03-03' },
  { ticker: 'SITM', status: 'open', entryPrice: 410, quantity: 1, openDate: '2026-03-03' },
  { ticker: 'OKTA', status: 'open', entryPrice: 71.73, quantity: 10, openDate: '2026-03-04' },
  { ticker: 'BTCE', status: 'open', entryPrice: 55.98, quantity: 100, openDate: '2026-03-04' },
  { ticker: 'COHR', status: 'open', entryPrice: 255.17, quantity: 2, openDate: '2026-03-05' },
  { ticker: 'IREN', status: 'open', entryPrice: 38.87, quantity: 15, openDate: '2026-03-05' },
  { ticker: 'GE', status: 'open', entryPrice: 325.78, quantity: 1, openDate: '2026-03-05' },
  { ticker: 'OKLO', status: 'open', entryPrice: 63.03, quantity: 10, openDate: '2026-03-05' },
]

const defaultShortPositions = [
  { ticker: 'LITE', status: 'open', entryPrice: 716.95, quantity: 3, exitPrice: 500, openDate: '2026-02-26' },
  { ticker: 'APP', status: 'open', entryPrice: 447.75, quantity: 6, openDate: '2026-02-26' },
  { ticker: 'HYMC', status: 'open', entryPrice: 54.95, quantity: 5, openDate: '2026-03-02' },
  { ticker: 'CAT', status: 'open', entryPrice: 742, quantity: 1, openDate: '2026-03-02' },
  { ticker: 'HYMC', status: 'open', entryPrice: 47.60, quantity: 5, openDate: '2026-03-03' },
  { ticker: 'MDB', status: 'open', entryPrice: 239.80, quantity: 2, openDate: '2026-03-03' },
  { ticker: 'MDB', status: 'open', entryPrice: 239.18, quantity: 2, openDate: '2026-03-03' },
  { ticker: 'MDB', status: 'open', entryPrice: 253.35, quantity: 2, openDate: '2026-03-03' },
  { ticker: 'POWL', status: 'open', entryPrice: 521, quantity: 2, openDate: '2026-03-04' },
  { ticker: 'CRDO', status: 'open', entryPrice: 113.93, quantity: 5, openDate: '2026-03-05' },
  { ticker: 'CRWD', status: 'open', entryPrice: 398.61, quantity: 10, openDate: '2026-03-05' },
]

const defaultClosedLongPositions = []

const defaultClosedShortPositions = [
  {
    ticker: 'HYMC',
    status: 'closed',
    entryPrice: 47.87,
    quantity: 10,
    exitPrice: 47.87,
    profitPercent: 0,
    profitDollar: 0,
    openDate: '2026-03-05',
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
  return _closedPositions.reduce((sum, p) => sum + (p.profitDollar || 0), 0)
}

export function calcDailyPnL() {
  const allOpen = [..._longPositions, ..._shortPositions].filter(p => p.status === 'open')
  return allOpen.reduce((sum, p) => sum + (p.dailyPnL || 0), 0)
}

// ── Helper: calculate % gain/loss ───────────────────────────────────────

function calcPnlPercent(position) {
  if (position.status === 'closed' && position.exitPrice && position.entryPrice) {
    return ((position.exitPrice - position.entryPrice) / position.entryPrice) * 100
  }
  if (position.profitPercent != null && position.profitPercent !== 0) {
    return position.profitPercent
  }
  if (position.profitDollar != null && position.entryPrice && position.quantity) {
    const totalCost = position.entryPrice * position.quantity
    if (totalCost > 0) return (position.profitDollar / totalCost) * 100
  }
  return null
}

// ── Aggregate duplicates ────────────────────────────────────────────────

function aggregatePositions(positions) {
  const grouped = {}
  for (const p of positions) {
    const key = p.ticker
    if (!grouped[key]) {
      grouped[key] = {
        ...p,
        totalCost: p.entryPrice * p.quantity,
        totalQuantity: p.quantity,
        earliestDate: p.openDate || '',
        totalDailyPnL: p.dailyPnL || 0,
        totalUnrealizedPnL: p.unrealizedPnL || 0,
        totalProfitDollar: p.profitDollar || 0,
      }
    } else {
      const g = grouped[key]
      g.totalCost += p.entryPrice * p.quantity
      g.totalQuantity += p.quantity
      if (p.openDate && (!g.earliestDate || p.openDate < g.earliestDate)) g.earliestDate = p.openDate
      g.totalDailyPnL += p.dailyPnL || 0
      g.totalUnrealizedPnL += p.unrealizedPnL || 0
      g.totalProfitDollar += p.profitDollar || 0
      if (p.exitPrice != null && g.exitPrice == null) g.exitPrice = p.exitPrice
    }
  }

  return Object.values(grouped).map(g => ({
    ...g,
    entryPrice: g.totalCost / g.totalQuantity,
    quantity: g.totalQuantity,
    openDate: g.earliestDate,
    dailyPnL: g.totalDailyPnL || undefined,
    unrealizedPnL: g.totalUnrealizedPnL || undefined,
    profitDollar: g.totalProfitDollar || undefined,
  }))
}

// ── Components ──────────────────────────────────────────────────────────

function GlowDot({ color }) {
  const colors = {
    green: 'bg-emerald-400 shadow-emerald-400/60',
    red: 'bg-red-400 shadow-red-400/60',
    orange: 'bg-orange-400 shadow-orange-400/60',
  }
  return (
    <span className="relative flex h-3 w-3 shrink-0">
      <span className={`glow-dot absolute inline-flex h-full w-full rounded-full opacity-75 ${colors[color]}`} />
      <span className={`relative inline-flex h-3 w-3 rounded-full ${colors[color]}`} />
    </span>
  )
}

function PositionRow({ position, type, onClick, selected, hidden }) {
  const isLong = type === 'long'
  const isClosed = position.status === 'closed'
  const sym = ccySym(position.currency)
  const pct = calcPnlPercent(position)

  const dotColor = isClosed ? 'red' : isLong ? 'green' : 'orange'
  const borderColor = isClosed
    ? 'border-red-500/20 hover:border-red-500/40'
    : isLong
      ? 'border-emerald-500/20 hover:border-emerald-500/40'
      : 'border-orange-500/20 hover:border-orange-500/40'

  // Date label: opening date for open, closing date for closed
  const dateLabel = isClosed && position.closeDate
    ? formatDate(position.closeDate)
    : position.openDate
      ? formatDate(position.openDate)
      : null

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer rounded-2xl border bg-slate-900/60 transition-all duration-300 ease-in-out ${borderColor} ${
        hidden ? 'scale-95 opacity-0 max-h-0 overflow-hidden !p-0 !m-0' : 'scale-100 opacity-100 max-h-[200px]'
      } ${selected ? 'bg-slate-800/60' : ''}`}
    >
      <div className="flex items-center gap-3 sm:gap-4 px-4 py-3 sm:px-5 sm:py-4">
        {/* Status dot */}
        <GlowDot color={dotColor} />

        {/* Long/Short label */}
        <span className={`text-xs font-bold uppercase tracking-wide shrink-0 w-10 ${
          isClosed ? 'text-slate-500' : isLong ? 'text-emerald-400/70' : 'text-orange-400/70'
        }`}>
          {isLong ? 'Long' : 'Short'}
        </span>

        {/* Ticker */}
        <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-100 w-14 sm:w-16 shrink-0">
          {position.ticker}
        </span>

        {/* Price */}
        <span className="text-sm sm:text-base font-bold text-blue-400 shrink-0">
          {sym}{position.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>

        {/* Shares */}
        <span className="text-xs sm:text-sm text-slate-400 shrink-0">
          {position.quantity} shares
        </span>

        {/* PnL badge */}
        {pct !== null && (
          <span className={`rounded-md px-2 py-0.5 text-xs font-bold shrink-0 ${pct >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
            {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
          </span>
        )}

        {/* Spacer + Date right-aligned */}
        <div className="flex-1 min-w-0" />
        {dateLabel && (
          <span className="text-[11px] text-slate-500 shrink-0">
            {isClosed ? `closed ${dateLabel}` : dateLabel}
          </span>
        )}
      </div>
    </div>
  )
}

function PositionList({ longs, shorts, selectedTicker, onSelectTicker }) {
  const allPositions = [
    ...longs.map(p => ({ ...p, _type: 'long' })),
    ...shorts.map(p => ({ ...p, _type: 'short' })),
  ].sort((a, b) => {
    // Closed positions first
    const aClosed = a.status === 'closed' ? 0 : 1
    const bClosed = b.status === 'closed' ? 0 : 1
    if (aClosed !== bClosed) return aClosed - bClosed

    // Then sort by PnL% descending (biggest gainer to biggest loser)
    const pctA = calcPnlPercent(a) ?? 0
    const pctB = calcPnlPercent(b) ?? 0
    return pctB - pctA
  })

  return (
    <div className="flex flex-col gap-2 px-2 sm:px-4">
      {allPositions.map((position, i) => (
        <PositionRow
          key={`${position._type}-${position.ticker}-${i}`}
          position={position}
          type={position._type}
          selected={selectedTicker === position.ticker}
          hidden={!!selectedTicker && position.ticker !== selectedTicker}
          onClick={() => onSelectTicker(position.ticker)}
        />
      ))}
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

  // Aggregate duplicates for display
  const aggregatedLongs = aggregatePositions([...longPositions, ...closedLongPositions])
  const aggregatedShorts = aggregatePositions([...shortPositions, ...closedShortPositions])

  const [selectedTicker, setSelectedTicker] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!selectedTicker) return
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setSelectedTicker(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [selectedTicker])

  function handleSelectTicker(ticker) {
    setSelectedTicker((prev) => (prev === ticker ? null : ticker))
  }

  return (
    <div className="mx-auto max-w-5xl" ref={containerRef}>
      {/* Tab bar */}
      <div className="flex items-center gap-6 border-b border-slate-800 px-4 sm:px-8 mb-3">
        <button className="border-b-2 border-emerald-400 pb-3 pt-4 text-sm font-semibold text-emerald-400">
          All Positions
        </button>
        <span className="pb-3 pt-4 text-sm text-slate-500">
          {aggregatedLongs.length} long
        </span>
        <span className="pb-3 pt-4 text-sm text-slate-500">
          {aggregatedShorts.length} short
        </span>
      </div>

      <PositionList
        longs={aggregatedLongs}
        shorts={aggregatedShorts}
        selectedTicker={selectedTicker}
        onSelectTicker={handleSelectTicker}
      />
    </div>
  )
}

export default Positions
