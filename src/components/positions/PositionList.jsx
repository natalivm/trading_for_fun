import { useState, memo } from 'react'
import PositionRow from './PositionRow'
import { calcPnlPercent } from './helpers'

// For closed tab, show only the top 10 most significant trades by default
const MAX_VISIBLE_CLOSED = 10

function PositionList({ longs, shorts, expandedTicker, onToggleTicker, filter, newPositionKeys }) {
  // Track which filter tab was active when the user clicked "OTHERS".
  // If the current filter differs, showOthers is implicitly false (auto-collapse on tab switch).
  const [showOthersFilter, setShowOthersFilter] = useState(null)
  const showOthers = showOthersFilter === filter

  const allPositions = [
    ...longs.map(p => ({ ...p, _type: 'long' })),
    ...shorts.map(p => ({ ...p, _type: 'short' })),
  ].filter(p => {
    if (filter === 'long') return p._type === 'long' && p.status !== 'closed'
    if (filter === 'short') return p._type === 'short' && p.status !== 'closed'
    if (filter === 'closed') return p.status === 'closed'
    return true
  }).sort((a, b) => {
    const pctA = calcPnlPercent(a, a._type === 'short') ?? 0
    const pctB = calcPnlPercent(b, b._type === 'short') ?? 0
    return pctB - pctA
  })

  const topGainerTicker = allPositions.reduce((best, p) => {
    if (p.status === 'closed') return best
    const pct = calcPnlPercent(p, p._type === 'short') ?? 0
    if (pct > 0 && pct > (best.pct ?? 0)) return { key: `${p._type}-${p.ticker}-${p.openDate}`, pct }
    return best
  }, { key: null, pct: 0 }).key

  const isClosed = filter === 'closed'
  const canCollapse = isClosed && allPositions.length > MAX_VISIBLE_CLOSED
  const hiddenCount = canCollapse ? allPositions.length - MAX_VISIBLE_CLOSED : 0
  const visiblePositions = canCollapse && !showOthers
    ? (() => {
        const sorted = [...allPositions].sort((a, b) => {
          const absA = Math.abs(calcPnlPercent(a, a._type === 'short') ?? 0)
          const absB = Math.abs(calcPnlPercent(b, b._type === 'short') ?? 0)
          return absB - absA
        })
        const topSet = new Set(sorted.slice(0, MAX_VISIBLE_CLOSED))
        return allPositions.filter(p => topSet.has(p))
      })()
    : allPositions

  return (
    <div className="flex flex-col gap-2 px-2 sm:px-4 sm:max-w-3xl sm:mx-auto w-full">
      {visiblePositions.map((position, i) => {
        const tradeKey = `${position._type}-${position.ticker}-${position.openDate || i}`
        const closedPrefix = position.status === 'closed' ? `closed-${position._type}` : position._type
        const newKey = `${closedPrefix}|${position.ticker}|${position.openDate}`
        return (
          <PositionRow
            key={tradeKey}
            position={position}
            type={position._type}
            expanded={expandedTicker === tradeKey}
            hidden={false}
            onToggle={() => onToggleTicker(tradeKey)}
            isNew={newPositionKeys?.has(newKey)}
            isTopGainer={tradeKey === topGainerTicker}
          />
        )
      })}
      {canCollapse && !showOthers && (
        <button
          onClick={() => setShowOthersFilter(filter)}
          className="w-full py-3 rounded-xl border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-700/40 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors"
        >
          OTHERS ({hiddenCount} more)
        </button>
      )}
      {canCollapse && showOthers && (
        <button
          onClick={() => setShowOthersFilter(null)}
          className="w-full py-2 rounded-xl border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-700/40 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors"
        >
          Hide others
        </button>
      )}
    </div>
  )
}

export default memo(PositionList)
