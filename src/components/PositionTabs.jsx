import { useState } from 'react'

const longPositions = [
  {
    ticker: 'ASML',
    status: 'open',
    entryPrice: 1250,
    quantity: 5,
    target: '+20%',
    date: 'Mar 5, 2026',
  },
]

const shortPositions = [
  {
    ticker: 'LITE',
    status: 'open',
    entryPrice: 730,
    quantity: 5,
    exitPrice: 500,
    date: 'Mar 5, 2026',
  },
]

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

function PositionCard({ position, type }) {
  const isLong = type === 'long'
  const borderColor = isLong
    ? 'border-blue-500/20 hover:border-blue-500/40'
    : 'border-orange-500/20 hover:border-orange-500/40'
  const accentColor = isLong ? 'text-blue-400' : 'text-orange-400'

  return (
    <div className={`rounded-2xl border bg-slate-900/60 p-4 transition ${borderColor}`}>
      <div className="mb-3 flex items-center justify-between">
        <StatusTag status={position.status} />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${accentColor}`}>
          {isLong ? 'Long' : 'Short'}
        </span>
      </div>

      <div className="mb-3">
        <span className="text-xl font-bold text-slate-100">{position.ticker}</span>
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
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{position.exitPrice != null ? 'Exit Target' : 'Target'}</span>
          <span className={`text-sm font-bold ${isLong ? 'text-emerald-400' : 'text-amber-400'}`}>
            {position.exitPrice != null ? `$${position.exitPrice.toLocaleString()}` : position.target}
          </span>
        </div>
      </div>
    </div>
  )
}

function PositionTabs() {
  const [activeTab, setActiveTab] = useState('long')

  const positions = activeTab === 'long' ? longPositions : shortPositions
  const dates = [...new Set(positions.map((p) => p.date))]

  return (
    <div className="mx-auto max-w-xl">
      {/* Tabs */}
      <div className="mb-5 flex gap-2">
        <button
          onClick={() => setActiveTab('long')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
            activeTab === 'long'
              ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
              : 'bg-slate-800/40 text-slate-500 hover:text-slate-400'
          }`}
        >
          Long
        </button>
        <button
          onClick={() => setActiveTab('short')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
            activeTab === 'short'
              ? 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30'
              : 'bg-slate-800/40 text-slate-500 hover:text-slate-400'
          }`}
        >
          Short
        </button>
      </div>

      {/* Positions grouped by date */}
      <div className="space-y-6">
        {dates.map((date) => (
          <div key={date} className="relative">
            {/* Background date */}
            <div className="mb-3 px-1">
              <span className="text-[11px] font-medium tracking-wide text-slate-600">{date}</span>
            </div>

            {/* Position cards */}
            <div className="space-y-3">
              {positions
                .filter((p) => p.date === date)
                .map((position) => (
                  <PositionCard key={position.ticker} position={position} type={activeTab} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PositionTabs
