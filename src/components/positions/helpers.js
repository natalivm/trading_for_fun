import { loadCachedPrices, saveCachedPrices, recordPriceSnapshot } from '../../utils/storage'
import { IGNORED_TICKERS } from '../../data/defaultPositions'

const MS_PER_DAY = 86400000

export const TODAY = new Date().toISOString().slice(0, 10)

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function daysBetween(a, b) {
  if (!a || !b) return null
  return Math.floor((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / MS_PER_DAY)
}

export function calcPnlPercent(position, isShort = false) {
  if (position.profitPercent != null && position.profitPercent !== 0) {
    return position.profitPercent
  }
  if (position.status === 'closed' && position.exitPrice && position.entryPrice) {
    const raw = ((position.exitPrice - position.entryPrice) / position.entryPrice) * 100
    return isShort ? -raw : raw
  }
  const totalCost = (position.entryPrice || 0) * (position.quantity || 0)
  if (totalCost > 0) {
    const pnl = position.unrealizedPnL || position.realizedPnL || position.profitDollar
    if (pnl != null) return (pnl / totalCost) * 100
    if (position.marketValue) return ((position.marketValue - totalCost) / totalCost) * 100
  }
  return null
}

// A "trade" = positions with same ticker opened on the same date.
export function groupFills(positions) {
  const grouped = {}
  for (const p of positions) {
    const key = `${p.ticker}|${p.openDate || ''}`
    if (!grouped[key]) {
      grouped[key] = {
        ...p,
        _totalCost: p.entryPrice * p.quantity,
        _totalExitCost: (p.exitPrice || 0) * p.quantity,
        _totalQty: p.quantity,
        _totalDailyPnL: p.dailyPnL || 0,
        _totalUnrealizedPnL: p.unrealizedPnL || 0,
        _totalRealizedPnL: p.realizedPnL || 0,
        _totalProfitDollar: p.profitDollar || 0,
        _totalFees: p.fees || 0,
        _totalMarketValue: p.marketValue || 0,
        _hasExit: p.exitPrice != null,
        _hasProfitDollar: p.profitDollar != null,
      }
    } else {
      const g = grouped[key]
      g._totalCost += p.entryPrice * p.quantity
      g._totalExitCost += (p.exitPrice || 0) * p.quantity
      g._totalQty += p.quantity
      g._totalDailyPnL += p.dailyPnL || 0
      g._totalUnrealizedPnL += p.unrealizedPnL || 0
      g._totalRealizedPnL += p.realizedPnL || 0
      g._totalProfitDollar += p.profitDollar || 0
      g._totalFees += p.fees || 0
      g._totalMarketValue += p.marketValue || 0
      if (p.exitPrice != null) g._hasExit = true
      if (p.profitDollar != null) g._hasProfitDollar = true
    }
  }
  return Object.values(grouped).map(g => ({
    ...g,
    entryPrice: g._totalCost / g._totalQty,
    exitPrice: g._hasExit ? g._totalExitCost / g._totalQty : undefined,
    quantity: g._totalQty,
    dailyPnL: g._totalDailyPnL || undefined,
    unrealizedPnL: g._totalUnrealizedPnL || undefined,
    realizedPnL: g._totalRealizedPnL || undefined,
    profitDollar: g._hasProfitDollar ? g._totalProfitDollar : undefined,
    profitPercent: undefined,
    fees: g._totalFees || undefined,
    marketValue: g._totalMarketValue || undefined,
  }))
}

export function groupIntoTrades(openPositions, closedPositions) {
  return [...groupFills(closedPositions), ...groupFills(openPositions)]
}

export function filterClosed2026(positions) {
  return positions.filter((p) => {
    const date = p.closeDate || p.openDate || ''
    return date.startsWith('2026')
  })
}

export function mergePositions(defaults, livePositions) {
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
          const entry = {
            ...def,
            ...live,
            openDate: def.openDate || live.openDate || '',
          }
          const liveQty = live.quantity || def.quantity || 0
          const liveEntry = live.entryPrice || def.entryPrice || 0

          if (live.marketValue && liveQty && liveEntry) {
            const currentPrice = live.marketValue / liveQty
            cachedPrices[live.ticker] = { price: currentPrice, marketValue: live.marketValue, qty: liveQty, updatedAt: TODAY }
            recordPriceSnapshot(live.ticker, currentPrice)
            if (!live.unrealizedPnL) {
              entry.unrealizedPnL = (currentPrice - liveEntry) * liveQty
            }
            if (!live.profitPercent) {
              entry.profitPercent = ((currentPrice - liveEntry) / liveEntry) * 100
            }
          } else if (cachedPrices[live.ticker || def.ticker] && liveQty && liveEntry) {
            const cached = cachedPrices[live.ticker || def.ticker]
            const restoredPrice = cached.price
            entry.marketValue = restoredPrice * liveQty
            if (!entry.unrealizedPnL) {
              entry.unrealizedPnL = (restoredPrice - liveEntry) * liveQty
            }
            if (!entry.profitPercent) {
              entry.profitPercent = ((restoredPrice - liveEntry) / liveEntry) * 100
            }
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
    if (!usedLiveTickers.has(ticker)) {
      merged.push(...entries)
    }
  }

  saveCachedPrices(cachedPrices)

  return merged
}

