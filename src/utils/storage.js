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

/**
 * @deprecated Use priceHistoryManager.getHistory(ticker) instead.
 * Kept for backward compatibility – returns the in-memory snapshot synchronously
 * if already loaded, otherwise returns an empty object.
 */
export function loadPriceHistory() {
  // Legacy callers expect a synchronous { [ticker]: [{date,price}] } object.
  // Return what the manager has already loaded into its cache.
  return priceHistoryManager._cache || {}
}

/**
 * Record a price snapshot – delegates to PriceHistoryManager which batches
 * writes and handles the IndexedDB fallback automatically.
 */
export function recordPriceSnapshot(ticker, price) {
  // Fire-and-forget; errors are swallowed inside the manager.
  priceHistoryManager.record(ticker, price)
}
