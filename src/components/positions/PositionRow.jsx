import { useState, useEffect, memo } from 'react'
import { API_BASE } from '../../utils/apiClient'
import { ccySym } from '../../utils/constants'
import GlowDot from './GlowDot'
import ExpandedDetail from './ExpandedDetail'
import { calcPnlPercent, daysBetween, formatDate, TODAY } from './helpers'

function FireIcon() {
  return (
    <span className="relative flex h-5 w-5 shrink-0 fire-icon">
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="#3B82F6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c0 4.5-5 7-5 11a5 5 0 0 0 10 0c0-4-5-6.5-5-11z" />
        <path d="M12 9c0 2.5-2 4-2 6a2 2 0 0 0 4 0c0-2-2-3.5-2-6z" />
      </svg>
    </span>
  )
}

function PositionRow({ position, type, expanded, onToggle, hidden, isTopGainer }) {
  const isLong = type === 'long'
  const isShort = type === 'short'
  const isClosed = position.status === 'closed'
  const sym = ccySym(position.currency)
  const pct = calcPnlPercent(position, isShort)

  const borderColor = isShort
    ? 'border-pink-500/20 hover:border-pink-500/40'
    : 'border-blue-500/20 hover:border-blue-500/40'

  let currentPrice = null
  if (!isClosed && position.quantity) {
    if (position.marketValue) {
      currentPrice = position.marketValue / position.quantity
    } else if (position.unrealizedPnL != null && position.entryPrice) {
      currentPrice = isShort
        ? position.entryPrice - position.unrealizedPnL / position.quantity
        : position.entryPrice + position.unrealizedPnL / position.quantity
    }
  }

  const pnlDollar = position.unrealizedPnL || position.realizedPnL || position.profitDollar
    || (currentPrice ? (currentPrice - position.entryPrice) * position.quantity : null)

  const days = isClosed
    ? daysBetween(position.openDate, position.closeDate)
    : daysBetween(position.openDate, TODAY)

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

  const sectionBase = `rounded-xl bg-slate-900/60 px-3 py-2 sm:px-4 sm:py-2.5`
  const displayPrice = isClosed && position.exitPrice != null
    ? position.exitPrice
    : currentPrice

  return (
    <div className={`${hidden ? 'scale-95 opacity-0 max-h-0 overflow-hidden !p-0 !m-0' : 'scale-100 opacity-100'} transition-all duration-300 ease-in-out w-full`}>
      <div>
        <div
          className={`group cursor-pointer rounded-2xl border transition-all duration-300 ease-in-out ${isTopGainer ? 'top-gainer-card border-blue-500 hover:border-blue-400' : borderColor} ${expanded ? 'ring-1 ring-slate-700/50' : ''}`}
          onClick={onToggle}
        >
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-[1px] bg-slate-700/30 rounded-2xl overflow-hidden">
            {/* Section 1: Status + Ticker + Quantity + Date (mobile) */}
            <div className={`${sectionBase} flex flex-col gap-1`}>
              <div className="flex items-center gap-2">
                {isClosed ? (
                  <svg className={`h-3 w-3 shrink-0 ${isShort ? 'text-pink-400' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isTopGainer ? (
                  <FireIcon />
                ) : (
                  <GlowDot color={isLong ? 'blue' : 'pink'} />
                )}
                <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-100 whitespace-nowrap">
                  {position.ticker}
                </span>
                <span className={`text-xs font-normal ${isShort ? 'text-pink-400/70' : 'text-blue-400/70'}`}>
                  x{position.quantity}
                </span>
              </div>
              {/* Date badge - visible on mobile only */}
              <div className="sm:hidden">
                {!isClosed && days !== null && days <= 1 ? (
                  <span className="rounded-md bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-400">
                    NEW
                  </span>
                ) : (
                  <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                    {days !== null ? `${days}d` : position.openDate ? formatDate(position.openDate) : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Section 2: Entry Price → Current/Exit Price + PnL (mobile) */}
            <div className={`${sectionBase} flex flex-col gap-1 whitespace-nowrap`}>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-bold ${isShort ? 'text-pink-400' : 'text-blue-400'}`}>
                  {sym}{position.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {displayPrice != null && (
                  <>
                    <span className="text-xs text-slate-500">→</span>
                    <span className={`text-sm font-bold ${(pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sym}{displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </>
                )}
              </div>
              {/* PnL badge - visible on mobile only */}
              {(pct || pnlDollar) ? (
                <div className="sm:hidden">
                  <span className={`rounded-md px-1.5 py-0.5 text-sm font-bold ${(pct ?? 0) >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {pct !== null && <>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</>}
                    {pct !== null && pnlDollar !== null && ' '}
                    {pnlDollar !== null && <>{pnlDollar >= 0 ? '+' : '-'}{sym}{Math.abs(pnlDollar).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Section 3: PnL + Date - desktop only */}
            <div className={`${sectionBase} hidden sm:flex items-center justify-end gap-2 whitespace-nowrap`}>
              {!isClosed && days !== null && days <= 1 ? (
                <span className="rounded-md bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-400">
                  NEW
                </span>
              ) : (
                <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                  {days !== null ? `${days}d` : position.openDate ? formatDate(position.openDate) : ''}
                </span>
              )}
              {(pct || pnlDollar) ? (
                <span className={`rounded-md px-1.5 py-0.5 text-sm font-bold ${(pct ?? 0) >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {pct !== null && <>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</>}
                  {pct !== null && pnlDollar !== null && ' '}
                  {pnlDollar !== null && <>{pnlDollar >= 0 ? '+' : '-'}{sym}{Math.abs(pnlDollar).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className={`mt-1 rounded-2xl border ${borderColor} bg-slate-900/60 overflow-hidden`}>
          <ExpandedDetail ticker={position.ticker} history={history} />
        </div>
      )}
    </div>
  )
}

export default memo(PositionRow)
