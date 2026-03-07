import { useState, useEffect, useRef } from 'react'

const TODAY = new Date().toISOString().slice(0, 10)

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysBetween(startDate, endDate) {
  if (!startDate) return null
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  return Math.floor((end - start) / (1000 * 60 * 60 * 24))
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
  { ticker: 'LITE', status: 'open', entryPrice: 716.95, quantity: 3, exitPrice: 500 },
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
        entries: [{ price: p.entryPrice, quantity: p.quantity, date: p.openDate }],
        earliestDate: p.openDate || '',
        latestDate: p.openDate || '',
        totalDailyPnL: p.dailyPnL || 0,
        totalUnrealizedPnL: p.unrealizedPnL || 0,
        totalProfitDollar: p.profitDollar || 0,
      }
    } else {
      const g = grouped[key]
      g.totalCost += p.entryPrice * p.quantity
      g.totalQuantity += p.quantity
      g.entries.push({ price: p.entryPrice, quantity: p.quantity, date: p.openDate })
      if (p.openDate && (!g.earliestDate || p.openDate < g.earliestDate)) g.earliestDate = p.openDate
      if (p.openDate && (!g.latestDate || p.openDate > g.latestDate)) g.latestDate = p.openDate
      g.totalDailyPnL += p.dailyPnL || 0
      g.totalUnrealizedPnL += p.unrealizedPnL || 0
      g.totalProfitDollar += p.profitDollar || 0
      // Keep exitPrice from any entry that has one
      if (p.exitPrice != null && g.exitPrice == null) g.exitPrice = p.exitPrice
    }
  }

  return Object.values(grouped).map(g => ({
    ...g,
    entryPrice: g.totalCost / g.totalQuantity, // weighted average
    quantity: g.totalQuantity,
    openDate: g.earliestDate,
    _latestDate: g.latestDate,
    _entryCount: g.entries.length,
    _entries: g.entries,
    dailyPnL: g.totalDailyPnL || undefined,
    unrealizedPnL: g.totalUnrealizedPnL || undefined,
    profitDollar: g.totalProfitDollar || undefined,
  }))
}

// ── Rating helper ───────────────────────────────────────────────────────

function getRating(position, type) {
  const pct = calcPnlPercent(position)
  if (position.status === 'closed') return { label: 'CLOSED', color: 'text-slate-500' }
  if (type === 'short') {
    if (pct !== null && pct < -5) return { label: 'STRONG SHORT', color: 'text-orange-400' }
    return { label: 'SHORT', color: 'text-orange-400/70' }
  }
  if (pct !== null && pct > 5) return { label: 'STRONG BUY', color: 'text-emerald-400' }
  if (pct !== null && pct < -5) return { label: 'HOLD', color: 'text-amber-400' }
  return { label: 'BUY', color: 'text-emerald-400/80' }
}

// ── Score helper (days holding → relative strength style) ───────────────

function getScore(position) {
  const days = position.status === 'closed'
    ? daysBetween(position.openDate, position.closeDate)
    : daysBetween(position.openDate, TODAY)
  if (days === null) return null
  const score = Math.max(1, Math.min(99, 100 - days))
  return score
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
  const rating = getRating(position, type)
  const score = getScore(position)
  const pct = calcPnlPercent(position)

  const dotColor = isClosed ? 'red' : isLong ? 'green' : 'orange'

  // Date labels
  const openLabel = position.openDate ? formatDate(position.openDate) : null
  const hasMultipleDates = position._latestDate && position._latestDate !== position.openDate
  const dateDisplay = hasMultipleDates
    ? `${openLabel} - ${formatDate(position._latestDate)}`
    : openLabel

  const closeLabel = isClosed && position.closeDate ? formatDate(position.closeDate) : null

  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer border-b border-slate-800/60 transition-all duration-300 ease-in-out ${
        hidden ? 'scale-95 opacity-0 max-h-0 overflow-hidden !py-0' : 'scale-100 opacity-100 max-h-[200px]'
      } ${selected ? 'bg-slate-800/40' : 'hover:bg-slate-800/20'}`}
    >
      <div className="flex items-center gap-4 sm:gap-6 px-4 py-4 sm:px-8 sm:py-5">
        {/* Status dot */}
        <GlowDot color={dotColor} />

        {/* Ticker */}
        <div className="w-14 sm:w-20 shrink-0">
          <span className="text-lg sm:text-2xl font-extrabold tracking-tight text-slate-100">
            {position.ticker}
          </span>
        </div>

        {/* Price + date */}
        <div className="w-24 sm:w-32 shrink-0">
          <div className="text-base sm:text-xl font-bold text-blue-400">
            {sym}{position.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          {dateDisplay && (
            <div className="mt-0.5 inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
              {isClosed ? `closed ${closeLabel}` : dateDisplay}
            </div>
          )}
        </div>

        {/* Rating */}
        <div className="w-28 sm:w-36 shrink-0 hidden sm:block">
          <span className={`text-xs sm:text-sm font-extrabold tracking-wide uppercase ${rating.color}`}>
            {rating.label}
          </span>
        </div>

        {/* Score badge */}
        {score !== null && (
          <div className="shrink-0 hidden md:flex items-center">
            <span className="inline-flex items-center justify-center rounded border border-emerald-500/40 px-2.5 py-1 text-xs sm:text-sm font-bold text-emerald-400 min-w-[56px]">
              RS {score}
            </span>
          </div>
        )}

        {/* Target / price range */}
        <div className="flex-1 min-w-0 flex items-center gap-2 justify-end sm:justify-start">
          {isClosed && position.exitPrice != null ? (
            <span className="text-sm font-semibold text-slate-300">
              {sym}{position.exitPrice.toLocaleString()}
            </span>
          ) : position.exitPrice != null ? (
            <span className="text-sm font-semibold text-slate-300">
              <span className="text-slate-400">{sym}{position.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span className="text-slate-600 mx-1">-</span>
              <span>{sym}{position.exitPrice.toLocaleString()}</span>
            </span>
          ) : null}

          {pct !== null && (
            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${pct >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Type + quantity label */}
        <div className="shrink-0 text-right">
          <span className="text-xs font-medium text-slate-500">
            {isLong ? 'Long' : 'Short'}
          </span>
          <div className="text-[10px] text-slate-600">
            {position.quantity}x{position._entryCount > 1 ? ` (${position._entryCount} buys)` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}

function PositionList({ longs, shorts, selectedTicker, onSelectTicker }) {
  const allPositions = [
    ...longs.map(p => ({ ...p, _type: 'long' })),
    ...shorts.map(p => ({ ...p, _type: 'short' })),
  ].sort((a, b) => {
    const dateA = a.openDate || ''
    const dateB = b.openDate || ''
    if (!dateA) return 1
    if (!dateB) return -1
    return dateB.localeCompare(dateA)
  })

  return (
    <div>
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
      <div className="flex items-center gap-6 border-b border-slate-800 px-4 sm:px-8 mb-1">
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
