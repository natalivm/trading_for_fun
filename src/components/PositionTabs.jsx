import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { loadCachedPrices, saveCachedPrices, recordPriceSnapshot } from '../utils/storage'
import { setPositionData } from '../utils/positionCalcs'
import { groupIntoTrades } from '../utils/tradeGrouping'
import {
  defaultLongPositions,
  defaultShortPositions,
  defaultClosedLongPositions,
  defaultClosedShortPositions,
  IGNORED_TICKERS,
} from '../data/defaultPositions'
import { PortfolioOverview } from './positions/PortfolioCharts'
import PositionList from './positions/PositionList'

const TODAY = new Date().toISOString().slice(0, 10)

function filterClosed2026(positions) {
  return positions.filter(p => {
    const date = p.closeDate || p.openDate || ''
    return date.startsWith('2026')
  })
}

function mergePositions(defaults, livePositions) {
  if (!livePositions || livePositions.length === 0) return defaults.filter(p => !IGNORED_TICKERS.has(p.ticker))

  const cachedPrices = loadCachedPrices()
  const liveByTicker = {}
  for (const pos of livePositions) {
    if (IGNORED_TICKERS.has(pos.ticker)) continue
    if (!liveByTicker[pos.ticker]) liveByTicker[pos.ticker] = []
    liveByTicker[pos.ticker].push(pos)
  }

  const merged = []
  const usedLiveTickers = new Set()

  for (const def of defaults) {
    const liveEntries = liveByTicker[def.ticker]
    if (liveEntries && liveEntries.length > 0) {
      if (!usedLiveTickers.has(def.ticker)) {
        for (const live of liveEntries) {
          const entry = { ...def, ...live, openDate: def.openDate || live.openDate || '' }
          const liveQty = live.quantity || def.quantity || 0
          const liveEntry = live.entryPrice || def.entryPrice || 0

          if (live.marketValue && liveQty && liveEntry) {
            const currentPrice = live.marketValue / liveQty
            cachedPrices[live.ticker] = { price: currentPrice, marketValue: live.marketValue, qty: liveQty, updatedAt: TODAY }
            recordPriceSnapshot(live.ticker, currentPrice)
            if (!live.unrealizedPnL) entry.unrealizedPnL = (currentPrice - liveEntry) * liveQty
            if (!live.profitPercent) entry.profitPercent = ((currentPrice - liveEntry) / liveEntry) * 100
          } else if (cachedPrices[live.ticker || def.ticker] && liveQty && liveEntry) {
            const cached = cachedPrices[live.ticker || def.ticker]
            const restoredPrice = cached.price
            entry.marketValue = restoredPrice * liveQty
            if (!entry.unrealizedPnL) entry.unrealizedPnL = (restoredPrice - liveEntry) * liveQty
            if (!entry.profitPercent) entry.profitPercent = ((restoredPrice - liveEntry) / liveEntry) * 100
          }
          if (!entry.profitPercent && def.profitPercent) entry.profitPercent = def.profitPercent
          if (!entry.unrealizedPnL && def.unrealizedPnL) entry.unrealizedPnL = def.unrealizedPnL
          merged.push(entry)
        }
        usedLiveTickers.add(def.ticker)
      }
    } else {
      merged.push(def)
    }
  }

  for (const [ticker, entries] of Object.entries(liveByTicker)) {
    if (!usedLiveTickers.has(ticker)) merged.push(...entries)
  }

  saveCachedPrices(cachedPrices)
  return merged
}

function Positions({ ibkrData }) {
  const hasLive = ibkrData && (ibkrData.longPositions || ibkrData.shortPositions)

  const longPositions = hasLive
    ? mergePositions(defaultLongPositions, ibkrData.longPositions)
    : defaultLongPositions.filter(p => !IGNORED_TICKERS.has(p.ticker))
  const shortPositions = hasLive
    ? mergePositions(defaultShortPositions, ibkrData.shortPositions)
    : defaultShortPositions.filter(p => !IGNORED_TICKERS.has(p.ticker))

  const liveClosedLong = filterClosed2026(ibkrData?.closedLongPositions || [])
  const liveClosedShort = filterClosed2026(ibkrData?.closedShortPositions || [])
  const closedLongKeys = useMemo(() => new Set(liveClosedLong.map(p => `${p.ticker}|${p.openDate}`)), [liveClosedLong])
  const closedShortKeys = useMemo(() => new Set(liveClosedShort.map(p => `${p.ticker}|${p.openDate}`)), [liveClosedShort])

  const closedLongPositions = useMemo(() => [
    ...liveClosedLong,
    ...filterClosed2026(defaultClosedLongPositions).filter(p => !closedLongKeys.has(`${p.ticker}|${p.openDate}`)),
  ], [liveClosedLong, closedLongKeys])

  const closedShortPositions = useMemo(() => [
    ...liveClosedShort,
    ...filterClosed2026(defaultClosedShortPositions).filter(p => !closedShortKeys.has(`${p.ticker}|${p.openDate}`)),
  ], [liveClosedShort, closedShortKeys])

  setPositionData({ longPositions, shortPositions, closedLongPositions, closedShortPositions })

  const tradeLongs = useMemo(() => groupIntoTrades(longPositions, closedLongPositions), [longPositions, closedLongPositions])
  const tradeShorts = useMemo(() => groupIntoTrades(shortPositions, closedShortPositions), [shortPositions, closedShortPositions])

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
    setExpandedTicker(prev => prev === ticker ? null : ticker)
  }, [])

  const allTrades = useMemo(() => [
    ...tradeLongs.map(p => ({ ...p, _type: 'long' })),
    ...tradeShorts.map(p => ({ ...p, _type: 'short' })),
  ], [tradeLongs, tradeShorts])

  const tabs = useMemo(() => {
    const longCount = allTrades.filter(p => p._type === 'long' && p.status !== 'closed').length
    const shortCount = allTrades.filter(p => p._type === 'short' && p.status !== 'closed').length
    const closedCount = allTrades.filter(p => p.status === 'closed').length
    return [
      { key: 'overview', label: 'Overview' },
      { key: 'long', label: 'Long', count: longCount },
      { key: 'short', label: 'Short', count: shortCount },
      { key: 'closed', label: 'Closed', count: closedCount },
    ]
  }, [allTrades])

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

  return (
    <div
      ref={contentRef}
      className="mx-auto max-w-5xl pb-20 min-h-[calc(100dvh-8rem)]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {filter === 'overview' ? (
        <PortfolioOverview
          allTrades={allTrades}
          closedPositions={[...closedLongPositions, ...closedShortPositions]}
        />
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
