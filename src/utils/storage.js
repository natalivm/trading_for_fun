import { priceHistoryManager } from './priceHistoryManager'

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
 * Load the full price history map ({ [ticker]: { date, price }[] }).
 * Delegates to PriceHistoryManager for consistency.
 */
export function loadPriceHistory() {
  try {
    return JSON.parse(localStorage.getItem('priceHistory')) || {}
  } catch { return {} }
}

// Backward-compatible helper: load history for a single ticker synchronously.
// Returns [] if not yet available.
export function loadPriceHistoryForTicker(ticker) {
  return priceHistoryManager.getAllEntries(ticker)
}

/**
 * Record a price snapshot for today.
 * Delegates to PriceHistoryManager which handles batching, compression,
 * and IndexedDB fallback.
 */
export function recordPriceSnapshot(ticker, price) {
  priceHistoryManager.record(ticker, price)
}
