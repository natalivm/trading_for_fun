// ── Price Statistics Utilities ──────────────────────────────────────────
// Functions for analysing price history entries ({ date, price }[]).

/**
 * Calculate annualised volatility (standard deviation of log returns × √252).
 * Requires at least 2 entries.
 * Returns null if insufficient data.
 */
export function calcVolatility(entries) {
  if (!entries || entries.length < 2) return null
  const returns = []
  for (let i = 1; i < entries.length; i++) {
    if (entries[i - 1].price > 0) {
      returns.push(Math.log(entries[i].price / entries[i - 1].price))
    }
  }
  if (returns.length < 2) return null
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1)
  return Math.sqrt(variance) * Math.sqrt(252)
}

/**
 * Calculate Simple Moving Average (SMA) over a rolling window.
 * Returns an array of { date, value } starting at index (period - 1).
 */
export function calcSMA(entries, period) {
  if (!entries || entries.length < period || period < 1) return []
  const result = []
  for (let i = period - 1; i < entries.length; i++) {
    const slice = entries.slice(i - period + 1, i + 1)
    const avg = slice.reduce((s, e) => s + e.price, 0) / period
    result.push({ date: entries[i].date, value: avg })
  }
  return result
}

/**
 * Calculate Exponential Moving Average (EMA) seeded from the first SMA.
 * Returns an array of { date, value } starting at index (period - 1).
 */
export function calcEMA(entries, period) {
  if (!entries || entries.length < period || period < 1) return []
  const k = 2 / (period + 1)
  const result = []

  const firstSMA = entries.slice(0, period).reduce((s, e) => s + e.price, 0) / period
  result.push({ date: entries[period - 1].date, value: firstSMA })

  for (let i = period; i < entries.length; i++) {
    const ema = entries[i].price * k + result[result.length - 1].value * (1 - k)
    result.push({ date: entries[i].date, value: ema })
  }
  return result
}

/**
 * Calculate the maximum drawdown from peak to trough.
 * Returns a value between 0 and 1 (e.g. 0.2 = 20% drawdown).
 * Returns null if fewer than 2 entries.
 */
export function calcMaxDrawdown(entries) {
  if (!entries || entries.length < 2) return null
  let peak = entries[0].price
  let maxDrawdown = 0
  for (const e of entries) {
    if (e.price > peak) peak = e.price
    const drawdown = peak > 0 ? (peak - e.price) / peak : 0
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }
  return maxDrawdown
}

/**
 * Calculate the total return from first to last entry.
 * Returns null if fewer than 2 entries or first price is zero.
 */
export function calcTotalReturn(entries) {
  if (!entries || entries.length < 2) return null
  const first = entries[0].price
  if (first <= 0) return null
  return (entries[entries.length - 1].price - first) / first
}
