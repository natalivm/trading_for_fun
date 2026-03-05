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
let _closedPositions = [...defaultClosedLongPositions, ...defaultClosedShortPositions]

export function setPositionData({ longPositions, closedLongPositions, closedShortPositions }) {
  _longPositions = longPositions
  _closedPositions = [...closedLongPositions, ...closedShortPositions]
}

export function calcCurrentlyInvested() {
  return _longPositions.reduce((sum, p) => sum + p.entryPrice * p.quantity, 0)
}

export function calcProfit() {
  return _closedPositions.reduce((sum, p) => sum + (p.profitDollar || 0), 0)
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
            <div className="mb-3 px-1 text-center">
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

function Positions({ ibkrData }) {
  const longPositions = ibkrData?.longPositions || defaultLongPositions
  const shortPositions = ibkrData?.shortPositions || defaultShortPositions
  const closedLongPositions = ibkrData?.closedLongPositions || defaultClosedLongPositions
  const closedShortPositions = ibkrData?.closedShortPositions || defaultClosedShortPositions

  // Keep the calculation helpers in sync
  setPositionData({ longPositions, closedLongPositions, closedShortPositions })

  const allLongs = [...longPositions, ...closedLongPositions]
  const allShorts = [...shortPositions, ...closedShortPositions]

  return (
    <div className="mx-auto max-w-3xl">
      <PositionList longs={allLongs} shorts={allShorts} />
    </div>
  )
}

export default Positions
