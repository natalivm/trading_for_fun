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
 * Record a price snapshot for today.
 * Delegates to PriceHistoryManager which handles batching, compression,
 * and IndexedDB fallback.
 */
export function recordPriceSnapshot(ticker, price) {
  priceHistoryManager.record(ticker, price)
}
