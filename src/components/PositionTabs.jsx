import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { setPositionData } from '../utils/positionCalcs'
import {
  IGNORED_TICKERS,
  defaultLongPositions,
  defaultShortPositions,
  defaultClosedLongPositions,
  defaultClosedShortPositions,
} from '../data/defaultPositions'
import {
  mergePositions,
  groupIntoTrades,
  filterClosed2026,
} from './positions/helpers'
import PositionList from './positions/PositionList'
import PortfolioOverview from './positions/PortfolioOverview'

function Positions({ ibkrData }) {
  // ── Position data ─────────────────────────────────────────────────────
  const longPositions = useMemo(() => {
    if (ibkrData && (ibkrData.longPositions || ibkrData.shortPositions)) {
      return mergePositions(defaultLongPositions, ibkrData.longPositions)
    }
    return defaultLongPositions.filter(p => !IGNORED_TICKERS.has(p.ticker))
  }, [ibkrData])

  const shortPositions = useMemo(() => {
    if (ibkrData && (ibkrData.longPositions || ibkrData.shortPositions)) {
      return mergePositions(defaultShortPositions, ibkrData.shortPositions)
    }
    return defaultShortPositions.filter(p => !IGNORED_TICKERS.has(p.ticker))
  }, [ibkrData])

  const closedLongPositions = useMemo(() => {
    const liveClosedLong = filterClosed2026(ibkrData?.closedLongPositions || [])
    const closedLongKeys = new Set(liveClosedLong.map(p => `${p.ticker}|${p.openDate}`))
    return [
      ...liveClosedLong,
      ...filterClosed2026(defaultClosedLongPositions).filter(p => !closedLongKeys.has(`${p.ticker}|${p.openDate}`)),
    ]
  }, [ibkrData])

  const closedShortPositions = useMemo(() => {
    const liveClosedShort = filterClosed2026(ibkrData?.closedShortPositions || [])
    const closedShortKeys = new Set(liveClosedShort.map(p => `${p.ticker}|${p.openDate}`))
    return [
      ...liveClosedShort,
      ...filterClosed2026(defaultClosedShortPositions).filter(p => !closedShortKeys.has(`${p.ticker}|${p.openDate}`)),
    ]
  }, [ibkrData])

  // Keep the calculation helpers in sync (use raw positions for accuracy)
  setPositionData({ longPositions, shortPositions, closedLongPositions, closedShortPositions })

  const tradeLongs = useMemo(
    () => groupIntoTrades(longPositions, closedLongPositions),
    [longPositions, closedLongPositions]
  )
  const tradeShorts = useMemo(
    () => groupIntoTrades(shortPositions, closedShortPositions),
    [shortPositions, closedShortPositions]
  )

  // ── NEW tag tracking ──────────────────────────────────────────────────
  // Load previous session's position keys once (lazy state initializer).
  // Using useState ensures prevKeys is a stable value, not a ref — so it
  // can safely be used inside useMemo without triggering react-hooks/refs.
  const [prevKeys] = useState(() => {
    const raw = localStorage.getItem('knownPositionKeys')
    return raw ? new Set(JSON.parse(raw)) : null
  })

  const newPositionKeys = useMemo(() => {
    const allCurrent = [
      ...longPositions.map(p => `long|${p.ticker}|${p.openDate}`),
      ...shortPositions.map(p => `short|${p.ticker}|${p.openDate}`),
      ...closedLongPositions.map(p => `closed-long|${p.ticker}|${p.openDate}`),
      ...closedShortPositions.map(p => `closed-short|${p.ticker}|${p.openDate}`),
    ]
    localStorage.setItem('knownPositionKeys', JSON.stringify(allCurrent))
    if (!prevKeys) return new Set()
    return new Set(allCurrent.filter(k => !prevKeys.has(k)))
  }, [longPositions, shortPositions, closedLongPositions, closedShortPositions, prevKeys])

  const [expandedTicker, setExpandedTicker] = useState(null)
  const [filter, setFilter] = useState('overview')
  const contentRef = useRef(null)

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'instant', block: 'start' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [filter])

  const handleToggleTicker = useCallback((ticker) => {
    setExpandedTicker((prev) => (prev === ticker ? null : ticker))
  }, [])

  const allTrades = useMemo(() => [
    ...tradeLongs.map(p => ({ ...p, _type: 'long' })),
    ...tradeShorts.map(p => ({ ...p, _type: 'short' })),
  ], [tradeLongs, tradeShorts])

  const longCount = useMemo(
    () => allTrades.filter(p => p._type === 'long' && p.status !== 'closed').length,
    [allTrades]
  )
  const shortCount = useMemo(
    () => allTrades.filter(p => p._type === 'short' && p.status !== 'closed').length,
    [allTrades]
  )
  const closedCount = useMemo(
    () => allTrades.filter(p => p.status === 'closed').length,
    [allTrades]
  )

  const tabs = useMemo(() => [
    { key: 'overview', label: 'Overview' },
    { key: 'long', label: 'Long', count: longCount },
    { key: 'short', label: 'Short', count: shortCount },
    { key: 'closed', label: 'Closed', count: closedCount },
  ], [longCount, shortCount, closedCount])

  // ── Swipe navigation between tabs ──────────────────────────────────────
  const touchStart = useRef(null)
  const touchStartY = useRef(null)

  const handleTouchStart = useCallback((e) => {
    touchStart.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback((e) => {
    if (touchStart.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStart.current
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    touchStart.current = null
    touchStartY.current = null

    if (Math.abs(deltaX) < 50 || Math.abs(deltaY) > Math.abs(deltaX)) return

    const tabKeys = tabs.map(t => t.key)
    const currentIdx = tabKeys.indexOf(filter)
    if (deltaX < 0 && currentIdx < tabKeys.length - 1) {
      setFilter(tabKeys[currentIdx + 1])
    } else if (deltaX > 0 && currentIdx > 0) {
      setFilter(tabKeys[currentIdx - 1])
    }
  }, [filter, tabs])

  const closedPositionsAll = useMemo(
    () => [...closedLongPositions, ...closedShortPositions],
    [closedLongPositions, closedShortPositions]
  )

  return (
    <div
      ref={contentRef}
      className="mx-auto max-w-5xl pb-20 min-h-[calc(100dvh-8rem)]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {filter === 'overview' ? (
        <PortfolioOverview allTrades={allTrades} closedPositions={closedPositionsAll} />
      ) : (
        <PositionList
          longs={tradeLongs}
          shorts={tradeShorts}
          expandedTicker={expandedTicker}
          onToggleTicker={handleToggleTicker}
          filter={filter}
          newPositionKeys={newPositionKeys}
        />
      )}

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl items-stretch justify-around sm:justify-center sm:gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`relative flex flex-1 sm:flex-none flex-col items-center gap-0.5 py-3 sm:px-5 text-xs font-semibold transition-colors ${
                filter === tab.key
                  ? 'text-emerald-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {filter === tab.key && (
                <span className="absolute top-0 h-0.5 w-10 rounded-b bg-emerald-400" />
              )}
              <span className="text-sm">{tab.label}</span>
              {tab.count != null && (
                <span className={`text-[10px] font-normal ${filter === tab.key ? 'text-emerald-400/70' : 'text-slate-600'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default Positions
