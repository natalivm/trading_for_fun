import priceHistoryManager from './priceHistoryManager'

const PRICE_CACHE_KEY = 'cachedPrices'

export function loadCachedPrices() {
  try {
    return JSON.parse(localStorage.getItem(PRICE_CACHE_KEY)) || {}
  } catch { return {} }
}

export function saveCachedPrices(prices) {
  localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(prices))
}

// Backward-compatible: loads from legacy localStorage key
export function loadPriceHistory() {
  try {
    return JSON.parse(localStorage.getItem('priceHistory')) || {}
  } catch { return {} }
}

// Routes to PriceHistoryManager for batched, compressed storage
export function recordPriceSnapshot(ticker, price) {
  priceHistoryManager.record(ticker, price)
}
