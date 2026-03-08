const PRICE_CACHE_KEY = 'cachedPrices'
const PRICE_HISTORY_KEY = 'priceHistory'
const MAX_HISTORY_PER_TICKER = 90 // keep ~90 entries per ticker

export function loadCachedPrices() {
  try {
    return JSON.parse(localStorage.getItem(PRICE_CACHE_KEY)) || {}
  } catch { return {} }
}

export function saveCachedPrices(prices) {
  localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(prices))
}

export function loadPriceHistory() {
  try {
    return JSON.parse(localStorage.getItem(PRICE_HISTORY_KEY)) || {}
  } catch { return {} }
}

export function recordPriceSnapshot(ticker, price) {
  const today = new Date().toISOString().slice(0, 10)
  const history = loadPriceHistory()
  if (!history[ticker]) history[ticker] = []
  const last = history[ticker][history[ticker].length - 1]
  // Only add one entry per day
  if (last && last.date === today) {
    last.price = price
  } else {
    history[ticker].push({ date: today, price })
  }
  // Trim old entries
  if (history[ticker].length > MAX_HISTORY_PER_TICKER) {
    history[ticker] = history[ticker].slice(-MAX_HISTORY_PER_TICKER)
  }
  localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history))
}
