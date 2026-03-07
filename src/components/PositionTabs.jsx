import { useState, useEffect, useRef } from 'react'

const TODAY = new Date().toISOString().slice(0, 10)

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysBetween(startDate, endDate) {
  if (!startDate) return null
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  return Math.floor((end - start) / (1000 * 60 * 60 * 24))
}

// ── Hardcoded fallback data ─────────────────────────────────────────────

// Currency symbol for display on individual cards (local price)
const CCY_SYMBOLS = { USD: '$', EUR: '€', CAD: 'C$', GBP: '£', CHF: 'CHF ' }
function ccySym(currency) {
  return CCY_SYMBOLS[currency] || (currency ? currency + ' ' : '$')
}

// Approximate FX rates to USD for aggregating invested/profit totals
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

// ── Components ──────────────────────────────────────────────────────────

function GlowDot({ color }) {
  const colors = {
    green: 'bg-emerald-400 shadow-emerald-400/60',
    red: 'bg-red-400 shadow-red-400/60',
  }
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`glow-dot absolute inline-flex h-full w-full rounded-full opacity-75 ${colors[color]}`} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${colors[color]}`} />
    </span>
  )
}

function StatusTag({ status }) {
  const isOpen = status === 'open'
  return (
    <div className="flex items-center gap-1.5">
      <GlowDot color={isOpen ? 'green' : 'red'} />
      <span className={`text-[10px] font-semibold uppercase tracking-wider ${isOpen ? 'text-emerald-400' : 'text-red-400'}`}>
        {status}
      </span>
    </div>
  )
}

function PnlBadge({ position }) {
  const pct = calcPnlPercent(position)
  if (pct === null) return null
  const isPositive = pct >= 0

  // Daily change % for open positions
  let dailyPct = null
  if (position.status === 'open' && position.dailyPnL != null && position.dailyPnL !== 0) {
    const cost = position.entryPrice * position.quantity
    if (cost > 0) dailyPct = (position.dailyPnL / cost) * 100
  }

  return (
    <span className="flex items-center gap-1.5">
      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
        {isPositive ? '+' : ''}{pct.toFixed(1)}%
      </span>
      {dailyPct !== null && (
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${dailyPct >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {dailyPct >= 0 ? '+' : ''}{dailyPct.toFixed(1)}%
        </span>
      )}
    </span>
  )
}

function DaysHolding({ position }) {
  const isClosed = position.status === 'closed'
  const days = isClosed
    ? daysBetween(position.openDate, position.closeDate)
    : daysBetween(position.openDate, TODAY)

  if (days === null) return null

  const label = days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`

  return (
    <span className="text-[10px] font-medium text-slate-500">
      {label}
    </span>
  )
}

function PositionCard({ position, type, onClick, selected, hidden }) {
  const isLong = type === 'long'
  const isClosed = position.status === 'closed'
  const sym = ccySym(position.currency)
  const borderColor = selected
    ? isLong ? 'border-blue-400/60 shadow-lg shadow-blue-500/10' : 'border-orange-400/60 shadow-lg shadow-orange-500/10'
    : isLong ? 'border-blue-500/20 hover:border-blue-500/40' : 'border-orange-500/20 hover:border-orange-500/40'
  const accentColor = isLong ? 'text-blue-400' : 'text-orange-400'

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border bg-slate-900/60 px-4 py-3 cursor-pointer transition-all duration-300 ease-in-out ${borderColor} ${hidden ? 'scale-95 opacity-0 max-h-0 !m-0 !p-0 overflow-hidden border-0' : 'scale-100 opacity-100 max-h-[500px]'} ${selected ? 'ring-1 ring-white/10' : ''}`}
    >
      <div className="flex items-center gap-4 whitespace-nowrap">
        <GlowDot color={isClosed ? 'red' : 'green'} />
        <span className={`text-[10px] font-bold uppercase tracking-widest w-10 ${accentColor}`}>
          {isLong ? 'Long' : 'Short'}
        </span>
        <span className="text-base font-bold text-slate-100 w-14">{position.ticker}</span>
        <span className="text-xs text-slate-500">{sym}{position.entryPrice.toLocaleString()}</span>
        <span className="text-xs text-slate-500">{position.quantity}x</span>
        {isClosed ? (
          <>
            <span className="text-xs text-slate-400">exit {sym}{position.exitPrice.toLocaleString()}</span>
            {position.profitDollar != null && (
              <span className={`text-xs font-bold ${position.profitDollar >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {position.profitDollar >= 0 ? '+' : ''}${position.profitDollar.toLocaleString()}
              </span>
            )}
          </>
        ) : (
          <>
            {position.dailyPnL != null && position.dailyPnL !== 0 && (
              <span className={`text-xs font-bold ${position.dailyPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {position.dailyPnL >= 0 ? '+' : ''}{((position.dailyPnL / (position.entryPrice * position.quantity)) * 100).toFixed(1)}% {position.dailyPnL >= 0 ? '+' : ''}${position.dailyPnL.toFixed(0)}
              </span>
            )}
            {position.unrealizedPnL != null && position.unrealizedPnL !== 0 && (
              <span className={`text-xs font-bold ${position.unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                unrl {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(0)}
              </span>
            )}
            {position.exitPrice != null && (
              <span className={`text-xs font-bold ${isLong ? 'text-emerald-400' : 'text-amber-400'}`}>
                target {sym}{position.exitPrice.toLocaleString()}
              </span>
            )}
          </>
        )}
        <PnlBadge position={position} />
        <span className="ml-auto"><DaysHolding position={position} /></span>
      </div>
    </div>
  )
}

function PositionList({ longs, shorts, selectedTicker, onSelectTicker }) {
  const allDates = [...new Set([
    ...longs.map((p) => p.openDate || ''),
    ...shorts.map((p) => p.openDate || ''),
  ])].sort((a, b) => {
    if (!a) return 1
    if (!b) return -1
    return new Date(b) - new Date(a)
  })

  return (
    <div className="space-y-6">
      {allDates.map((date) => {
        const longsForDate = longs.filter((p) => (p.openDate || '') === date)
        const shortsForDate = shorts.filter((p) => (p.openDate || '') === date)
        const hasLongs = longsForDate.length > 0
        const hasShorts = shortsForDate.length > 0
        const hasBoth = hasLongs && hasShorts
        const displayDate = date ? formatDate(date) : 'No date'

        const dateHasMatch = !selectedTicker || longsForDate.some((p) => p.ticker === selectedTicker) || shortsForDate.some((p) => p.ticker === selectedTicker)

        return (
          <div
            key={date || 'no-date'}
            className={`relative transition-all duration-300 ease-in-out ${selectedTicker && !dateHasMatch ? 'opacity-0 max-h-0 overflow-hidden !my-0' : 'opacity-100'}`}
          >
            <div className="mb-3 px-1 text-center">
              <span className={`text-[11px] font-medium tracking-wide transition-colors duration-300 ${selectedTicker && dateHasMatch ? 'text-slate-400' : 'text-slate-600'}`}>{displayDate}</span>
            </div>

            <div className="space-y-2">
              {longsForDate.map((position, i) => (
                <PositionCard
                  key={`long-${position.ticker}-${i}`}
                  position={position}
                  type="long"
                  selected={selectedTicker === position.ticker}
                  hidden={!!selectedTicker && position.ticker !== selectedTicker}
                  onClick={() => onSelectTicker(position.ticker)}
                />
              ))}
              {shortsForDate.map((position, i) => (
                <PositionCard
                  key={`short-${position.ticker}-${i}`}
                  position={position}
                  type="short"
                  selected={selectedTicker === position.ticker}
                  hidden={!!selectedTicker && position.ticker !== selectedTicker}
                  onClick={() => onSelectTicker(position.ticker)}
                />
              ))}
            </div>
          </div>
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

/**
 * Merge hardcoded defaults with live IB data.
 * - Live positions override hardcoded ones (matched by ticker)
 * - Hardcoded positions not in live are kept (IB might not show old ones)
 * - New live positions not in hardcoded are added
 * - Live closed positions (executions) are merged with hardcoded closed
 */
function mergePositions(defaults, livePositions) {
  if (!livePositions || livePositions.length === 0) return defaults

  // Build a map of live positions by ticker (there can be multiple per ticker)
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
      // Live overrides this ticker — find best match by quantity or take first
      if (!usedLiveTickers.has(def.ticker)) {
        // First time seeing this ticker: add all live entries for it
        for (const live of liveEntries) {
          merged.push({
            ...def,
            ...live,
            openDate: def.openDate || live.openDate || '',
          })
        }
        usedLiveTickers.add(def.ticker)
      }
      // Skip additional hardcoded entries for same ticker (live has the truth)
    } else {
      // No live data for this ticker — keep hardcoded
      merged.push(def)
    }
  }

  // Add any live positions for tickers not in hardcoded defaults
  for (const [ticker, entries] of Object.entries(liveByTicker)) {
    if (!usedLiveTickers.has(ticker)) {
      merged.push(...entries)
    }
  }

  return merged
}

function Positions({ ibkrData }) {
  const hasLive = ibkrData && (ibkrData.longPositions || ibkrData.shortPositions)

  // Merge: live data updates hardcoded, hardcoded fills in what live doesn't have
  const longPositions = hasLive
    ? mergePositions(defaultLongPositions, ibkrData.longPositions)
    : defaultLongPositions
  const shortPositions = hasLive
    ? mergePositions(defaultShortPositions, ibkrData.shortPositions)
    : defaultShortPositions

  // Closed positions: merge live executions with hardcoded closed, deduplicate
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

  // Keep the calculation helpers in sync
  setPositionData({ longPositions, shortPositions, closedLongPositions, closedShortPositions })

  const allLongs = [...longPositions, ...closedLongPositions]
  const allShorts = [...shortPositions, ...closedShortPositions]

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
    <div className="mx-auto max-w-4xl" ref={containerRef}>
      <PositionList
        longs={allLongs}
        shorts={allShorts}
        selectedTicker={selectedTicker}
        onSelectTicker={handleSelectTicker}
      />
    </div>
  )
}

export default Positions
