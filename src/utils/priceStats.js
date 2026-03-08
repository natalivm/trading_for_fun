// ── Price Statistics Utilities ──────────────────────────────────────────
// Functions for analyzing price history entries ({ date, price }[]).

/**
 * Calculate annualized volatility (standard deviation of log returns × √252).
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

// ── Aggregate stats helper ────────────────────────────────────────────────

import { priceHistoryManager } from './priceHistoryManager'

/**
 * Get all key stats for a ticker in one call.
 * Loads entries once and derives all stats from a single dataset.
 */
export function getPriceStats(ticker) {
  const all = priceHistoryManager.getAllEntries(ticker)
  if (all.length === 0) return { ma7: null, ma30: null, volatility: null, change1d: null, change7d: null, change30d: null }

  const now = new Date()
  const cutoff7 = new Date(now); cutoff7.setDate(cutoff7.getDate() - 7)
  const cutoff30 = new Date(now); cutoff30.setDate(cutoff30.getDate() - 30)
  const cutoff7Str = cutoff7.toISOString().slice(0, 10)
  const cutoff30Str = cutoff30.toISOString().slice(0, 10)

  const recent7 = all.filter(e => e.date >= cutoff7Str)
  const recent30 = all.filter(e => e.date >= cutoff30Str)

  const ma7 = recent7.length > 0 ? recent7.reduce((s, e) => s + e.price, 0) / recent7.length : null
  const ma30 = recent30.length > 0 ? recent30.reduce((s, e) => s + e.price, 0) / recent30.length : null
  const volatility = calcVolatility(recent30)

  const latest = all[all.length - 1]
  function priceChange(days) {
    const cutoff = new Date(latest.date + 'T00:00:00')
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    // Scan backwards for the most recent entry at or before the cutoff
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].date <= cutoffStr) {
        return ((latest.price - all[i].price) / all[i].price) * 100
      }
    }
    return null
  }

  return {
    ma7,
    ma30,
    volatility,
    change1d: all.length >= 2 ? priceChange(1) : null,
    change7d: all.length >= 2 ? priceChange(7) : null,
    change30d: all.length >= 2 ? priceChange(30) : null,
  }
}
