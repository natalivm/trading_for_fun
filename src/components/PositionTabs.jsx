import { useState } from 'react'

const TODAY = '2026-03-05'

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

const longPositions = [
  { ticker: 'FTNT', status: 'open', entryPrice: 84.46, quantity: 10, openDate: '2026-01-12' },
  { ticker: 'CEG', status: 'open', entryPrice: 280.17, quantity: 2, openDate: '2026-02-12' },
  { ticker: 'CEG', status: 'open', entryPrice: 310.77, quantity: 2, openDate: '2026-02-12' },
  { ticker: 'THM', status: 'open', entryPrice: 2.29, quantity: 100, openDate: '2026-02-17' },
  { ticker: 'RIG', status: 'open', entryPrice: 6.15, quantity: 100, openDate: '2026-02-17' },
  { ticker: 'RIG', status: 'open', entryPrice: 6.14, quantity: 100, openDate: '2026-02-20' },
  { ticker: 'DASH', status: 'open', entryPrice: 164.14, quantity: 2, openDate: '2026-02-24' },
  { ticker: 'DASH', status: 'open', entryPrice: 174.35, quantity: 2, openDate: '2026-02-25' },
  { ticker: 'THM', status: 'open', entryPrice: 2.93, quantity: 100, openDate: '2026-02-25' },
  { ticker: 'CEG', status: 'open', entryPrice: 319.18, quantity: 2, openDate: '2026-03-03' },
  { ticker: 'NOW', status: 'open', entryPrice: 108.53, quantity: 10, openDate: '2026-03-03' },
  { ticker: 'MELI', status: 'open', entryPrice: 1652, quantity: 1, openDate: '2026-03-03' },
  { ticker: 'THM', status: 'open', entryPrice: 3.32, quantity: 100, openDate: '2026-03-03' },
  { ticker: 'PINS', status: 'open', entryPrice: 19.10, quantity: 30, openDate: '2026-03-03' },
  { ticker: 'LRMR', status: 'open', entryPrice: 5.30, quantity: 100, openDate: '2026-03-03' },
  { ticker: 'ARRY', status: 'open', entryPrice: 7.29, quantity: 100, openDate: '2026-03-03' },
  { ticker: 'OKTA', status: 'open', entryPrice: 71.73, quantity: 10, openDate: '2026-03-04' },
  { ticker: 'COHR', status: 'open', entryPrice: 265.20, quantity: 1, openDate: '2026-03-04' },
  { ticker: 'IREN', status: 'open', entryPrice: 38.87, quantity: 15, openDate: '2026-03-05' },
  { ticker: 'GE', status: 'open', entryPrice: 325.78, quantity: 1, openDate: '2026-03-05' },
  { ticker: 'OKLO', status: 'open', entryPrice: 63.03, quantity: 10, openDate: '2026-03-05' },
]

const shortPositions = [
  { ticker: 'LITE', status: 'open', entryPrice: 716.95, quantity: 3, exitPrice: 500 },
  { ticker: 'HYMC', status: 'open', entryPrice: 54.95, quantity: 5, openDate: '2026-03-02' },
  { ticker: 'HYMC', status: 'open', entryPrice: 47.60, quantity: 5, openDate: '2026-03-03' },
  { ticker: 'CAT', status: 'open', entryPrice: 742, quantity: 1, openDate: '2026-03-02' },
  { ticker: 'POWL', status: 'open', entryPrice: 521, quantity: 2, openDate: '2026-03-04' },
  { ticker: 'CRDO', status: 'open', entryPrice: 113.93, quantity: 5, openDate: '2026-03-05' },
]

const closedLongPositions = []

const closedShortPositions = [
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

// Calculate currently invested (open long positions only)
export function calcCurrentlyInvested() {
  return longPositions.reduce((sum, p) => sum + p.entryPrice * p.quantity, 0)
}

// Calculate total profit from all closed positions
export function calcProfit() {
  const closedAll = [...closedLongPositions, ...closedShortPositions]
  return closedAll.reduce((sum, p) => sum + p.profitDollar, 0)
}

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

function PositionCard({ position, type }) {
  const isLong = type === 'long'
  const isClosed = position.status === 'closed'
  const borderColor = isLong
    ? 'border-blue-500/20 hover:border-blue-500/40'
    : 'border-orange-500/20 hover:border-orange-500/40'
  const accentColor = isLong ? 'text-blue-400' : 'text-orange-400'

  return (
    <div className={`rounded-2xl border bg-slate-900/60 p-4 transition ${borderColor}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusTag status={position.status} />
          <DaysHolding position={position} />
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${accentColor}`}>
          {isLong ? 'Long' : 'Short'}
        </span>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-xl font-bold text-slate-100">{position.ticker}</span>
        {isClosed && (
          <span className={`text-sm font-bold ${position.profitDollar >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {position.profitPercent >= 0 ? '+' : ''}{position.profitPercent.toFixed(1)}% = {position.profitDollar >= 0 ? '+' : ''}${Math.abs(position.profitDollar).toLocaleString()}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Entry Price</span>
          <span className="text-sm font-semibold text-slate-200">${position.entryPrice.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Quantity</span>
          <span className="text-sm font-semibold text-slate-200">{position.quantity} shares</span>
        </div>
        {isClosed ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Exit Price</span>
            <span className="text-sm font-semibold text-slate-200">${position.exitPrice.toLocaleString()}</span>
          </div>
        ) : (
          position.exitPrice != null && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Exit Target</span>
              <span className={`text-sm font-bold ${isLong ? 'text-emerald-400' : 'text-amber-400'}`}>
                ${position.exitPrice.toLocaleString()}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  )
}

function PositionList({ longs, shorts }) {
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

        return (
          <div key={date || 'no-date'} className="relative">
            <div className="mb-3 px-1">
              <span className="text-[11px] font-medium tracking-wide text-slate-600">{displayDate}</span>
            </div>

            {hasBoth ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  {longsForDate.map((position, i) => (
                    <PositionCard key={`${position.ticker}-${i}`} position={position} type="long" />
                  ))}
                </div>
                <div className="space-y-3">
                  {shortsForDate.map((position, i) => (
                    <PositionCard key={`${position.ticker}-${i}`} position={position} type="short" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-xl">
                <div className="space-y-3">
                  {longsForDate.map((position, i) => (
                    <PositionCard key={`${position.ticker}-${i}`} position={position} type="long" />
                  ))}
                  {shortsForDate.map((position, i) => (
                    <PositionCard key={`${position.ticker}-${i}`} position={position} type="short" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Positions() {
  const [activeTab, setActiveTab] = useState('open')

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setActiveTab('open')}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition ${
            activeTab === 'open'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-slate-800/60 text-slate-500 hover:text-slate-300'
          }`}
        >
          Open
        </button>
        <button
          onClick={() => setActiveTab('closed')}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition ${
            activeTab === 'closed'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-slate-800/60 text-slate-500 hover:text-slate-300'
          }`}
        >
          Closed
        </button>
      </div>

      {activeTab === 'open' ? (
        <PositionList longs={longPositions} shorts={shortPositions} />
      ) : (
        <PositionList longs={closedLongPositions} shorts={closedShortPositions} />
      )}
    </div>
  )
}

export default Positions
