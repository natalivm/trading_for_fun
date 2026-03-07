import { calcCurrentlyInvested, calcProfit, calcDailyPnL } from './PositionTabs'

function Header({ portfolio }) {
  const invested = calcCurrentlyInvested()
  const profit = calcProfit()
  const dailyPnL = calcDailyPnL()
  const isPositive = profit >= 0
  const dailyPositive = dailyPnL >= 0
  const hasDailyData = dailyPnL !== 0

  const updatedLabel = portfolio?.updatedAt
    ? 'Updated ' + new Date(portfolio.updatedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null

  const dailyPct = invested > 0 && hasDailyData ? (dailyPnL / invested) * 100 : null

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800/50 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto max-w-5xl px-4 sm:px-8">
        {/* Top row: logo + updated timestamp */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
              <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              TradingFun
            </h1>
          </div>
          {updatedLabel && (
            <span className="text-[11px] text-slate-600">{updatedLabel}</span>
          )}
        </div>

        {/* Stats row: Invested + Profit centered, Daily on right */}
        <div className="flex items-center justify-center border-t border-slate-800/40 py-3">
          <div className="flex items-center gap-5">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-600">Invested</span>
              <span className="text-lg font-bold text-slate-200 tabular-nums">
                ${invested.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-600">Profit</span>
              <span className={`text-lg font-bold tabular-nums ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? '+' : '-'}${Math.abs(profit).toLocaleString()}
              </span>
            </div>

            {hasDailyData && (
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-600">Daily</span>
                <span className={`text-lg font-bold tabular-nums ${dailyPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {dailyPositive ? '+' : '-'}${Math.abs(dailyPnL).toLocaleString()}
                </span>
                {dailyPct !== null && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${dailyPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {dailyPct >= 0 ? '+' : ''}{dailyPct.toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
