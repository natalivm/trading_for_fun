import { memo } from 'react'
import { toUSD } from '../../utils/constants'
import { daysBetween } from './helpers'

function QuickStats({ allTrades, closedPositions }) {
  const closed = closedPositions.filter(p => p.profitDollar != null)
  const wins = closed.filter(p => (p.profitDollar - (p.fees || 0)) > 0)
  const losses = closed.filter(p => (p.profitDollar - (p.fees || 0)) <= 0)
  const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(0) : '—'

  const best = closed.length > 0
    ? closed.reduce((a, b) => (toUSD(a.profitDollar - (a.fees || 0), a.currency) > toUSD(b.profitDollar - (b.fees || 0), b.currency) ? a : b))
    : null
  const worst = closed.length > 0
    ? closed.reduce((a, b) => (toUSD(a.profitDollar - (a.fees || 0), a.currency) < toUSD(b.profitDollar - (b.fees || 0), b.currency) ? a : b))
    : null

  const holdDays = closed.map(p => daysBetween(p.openDate, p.closeDate)).filter(d => d != null)
  const avgHold = holdDays.length > 0 ? (holdDays.reduce((a, b) => a + b, 0) / holdDays.length).toFixed(0) : '—'

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

export default memo(QuickStats)
