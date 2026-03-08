// ── Price Analytics Utilities ────────────────────────────────────────────
// Provide high/low/average, volatility, and moving averages
// Works with entries from PriceHistoryManager: { date, price }

/** Compute high, low, and average price from a list of entries */
export function priceStats(entries) {
  if (!entries || entries.length === 0) return null
  const prices = entries.map(e => e.price)
  const high = Math.max(...prices)
  const low = Math.min(...prices)
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length
  const latest = prices[prices.length - 1]
  const oldest = prices[0]
  const change = latest - oldest
  const changePct = oldest ? (change / oldest) * 100 : 0
  return { high, low, avg, latest, oldest, change, changePct, count: prices.length }
}

/**
 * Compute historical volatility (annualized standard deviation of log returns).
 * Returns a decimal fraction (e.g., 0.25 = 25%).
 */
export function historicalVolatility(entries) {
  if (!entries || entries.length < 2) return null
  const logReturns = []
  for (let i = 1; i < entries.length; i++) {
    if (entries[i - 1].price > 0 && entries[i].price > 0) {
      logReturns.push(Math.log(entries[i].price / entries[i - 1].price))
    }
  }
  if (logReturns.length < 2) return null
  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length
  const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1)
  // Annualize: assume ~252 trading days
  return Math.sqrt(variance * 252)
}

/**
 * Compute a simple moving average (SMA) over `period` entries.
 * Returns an array of { date, sma } with null for the first (period-1) entries.
 */
export function simpleMovingAverage(entries, period) {
  if (!entries || entries.length === 0 || period < 1) return []
  return entries.map((e, i) => {
    if (i < period - 1) return { date: e.date, sma: null }
    const slice = entries.slice(i - period + 1, i + 1)
    const sma = slice.reduce((s, x) => s + x.price, 0) / period
    return { date: e.date, sma }
  })
}

/**
 * Compute an exponential moving average (EMA) over `period` entries.
 * Returns an array of { date, ema }.
 */
export function exponentialMovingAverage(entries, period) {
  if (!entries || entries.length === 0 || period < 1) return []
  const k = 2 / (period + 1)
  let ema = entries[0].price
  return entries.map((e, i) => {
    if (i === 0) return { date: e.date, ema }
    ema = e.price * k + ema * (1 - k)
    return { date: e.date, ema }
  })
}

/**
 * Compute relative strength index (RSI) over `period` entries (default 14).
 * Returns an array of { date, rsi } with null for the first `period` entries.
 */
export function rsi(entries, period = 14) {
  if (!entries || entries.length <= period) return entries?.map(e => ({ date: e.date, rsi: null })) || []
  const result = entries.map(e => ({ date: e.date, rsi: null }))
  let avgGain = 0, avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const change = entries[i].price - entries[i - 1].price
    if (change > 0) avgGain += change / period
    else avgLoss += Math.abs(change) / period
  }

  if (avgLoss === 0) {
    result[period].rsi = 100
  } else {
    result[period].rsi = 100 - 100 / (1 + avgGain / avgLoss)
  }

  for (let i = period + 1; i < entries.length; i++) {
    const change = entries[i].price - entries[i - 1].price
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result[i].rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }

  return result
}

/**
 * Find price range (high, low) for a given date range.
 */
export function priceRange(entries, from, to) {
  const filtered = entries.filter(e => (!from || e.date >= from) && (!to || e.date <= to))
  return priceStats(filtered)
}
