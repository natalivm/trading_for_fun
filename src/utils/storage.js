import { priceHistoryManager } from './priceHistory'

const PRICE_CACHE_KEY = 'cachedPrices'

export function loadCachedPrices() {
  try {
    return JSON.parse(localStorage.getItem(PRICE_CACHE_KEY)) || {}
  } catch { return {} }
}

export function saveCachedPrices(prices) {
  localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(prices))
}

// Delegate to PriceHistoryManager — fire-and-forget (async internally batched)
export function recordPriceSnapshot(ticker, price) {
  priceHistoryManager.recordPrice(ticker, price)
}

// Backward-compatible helper: load history for a single ticker synchronously
// from localStorage (without async). Returns [] if not yet available.
export function loadPriceHistoryForTicker(ticker) {
  try {
    const raw = localStorage.getItem('priceHistory_' + ticker)
    if (raw) return JSON.parse(raw) || []
  } catch { /* ignore */ }
  return []
}
