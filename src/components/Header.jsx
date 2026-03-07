import { calcCurrentlyInvested, calcProfit, calcDailyPnL } from './PositionTabs'

function Header({ portfolio }) {
  const invested = calcCurrentlyInvested()
  const profit = calcProfit()
  const dailyPnL = calcDailyPnL()
  const isPositive = profit >= 0
  const dailyPositive = dailyPnL >= 0
  const hasDailyData = dailyPnL !== 0

  // Format "Updated" timestamp from portfolio
  const updatedLabel = portfolio?.updatedAt
    ? 'Updated ' + new Date(portfolio.updatedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null

  // Calculate daily P/L as % of invested
  const dailyPct = invested > 0 && hasDailyData ? (dailyPnL / invested) * 100 : null

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-100">
            TradingFun
          </h1>
        </div>
        <button className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </button>
      </div>
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-4 border-t border-slate-800/50 px-4 py-2 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Invested</span>
          <span className="text-sm font-bold text-slate-200">${invested.toLocaleString()}</span>
        </div>
        {updatedLabel && (
          <>
            <div className="h-3 w-px bg-slate-700" />
            <span className="text-[10px] text-slate-500">{updatedLabel}</span>
          </>
        )}
        <div className="h-3 w-px bg-slate-700" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Profit</span>
          <span className={`text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : '-'}${Math.abs(profit).toLocaleString()}
          </span>
          {hasDailyData && (
            <span className={`text-[10px] font-bold ${dailyPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {dailyPositive ? '+' : '-'}${Math.abs(dailyPnL).toLocaleString()}{dailyPct !== null && ` (${dailyPct >= 0 ? '+' : ''}${dailyPct.toFixed(1)}%)`}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
