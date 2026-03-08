// ── Position merging: default data + live IBKR data ──────────────────────

import { loadCachedPrices, saveCachedPrices, recordPriceSnapshot } from './storage'

const TODAY = new Date().toISOString().slice(0, 10)

// Tickers to ignore during sync (leftovers, corporate actions, etc.)
export const IGNORED_TICKERS = new Set(['EUGM'])

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
            // IBKR delivered fresh data — use it and cache the price
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
            // IBKR returned null/zero — restore last known price
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
          // Still fall back to manual defaults if nothing else available
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

  // Persist updated price cache
  saveCachedPrices(cachedPrices)

  return merged
}
