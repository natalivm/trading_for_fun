// ── Price Analytics ──────────────────────────────────────────────────────
// Provides volatility metrics, moving averages, and price change percentages.

import { priceHistoryManager } from './priceHistory'

// ── Daily high/low/average ────────────────────────────────────────────────

export async function getDailyStats(ticker, date) {
  const entries = await priceHistoryManager.loadTicker(ticker)
  const dayEntries = entries.filter(e => e.date === date)
  if (dayEntries.length === 0) return null
  const prices = dayEntries.map(e => e.price)
  return {
    high: Math.max(...prices),
    low: Math.min(...prices),
    average: prices.reduce((s, p) => s + p, 0) / prices.length,
  }
}

// ── Moving averages ───────────────────────────────────────────────────────

export async function getMovingAverage(ticker, days) {
  const entries = await priceHistoryManager.loadTicker(ticker)
  if (entries.length === 0) return null
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const recent = entries.filter(e => e.date >= cutoffStr)
  if (recent.length === 0) return null
  return recent.reduce((s, e) => s + e.price, 0) / recent.length
}

// ── Volatility ────────────────────────────────────────────────────────────
// Annualized standard deviation of daily log returns

export async function getVolatility(ticker, days = 30) {
  const entries = await priceHistoryManager.loadTicker(ticker)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const recent = entries.filter(e => e.date >= cutoffStr).sort((a, b) => a.date.localeCompare(b.date))
  if (recent.length < 2) return null

  const logReturns = []
  for (let i = 1; i < recent.length; i++) {
    logReturns.push(Math.log(recent[i].price / recent[i - 1].price))
  }
  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length
  const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1)
  const dailyVol = Math.sqrt(variance)
  return dailyVol * Math.sqrt(252) // annualize
}

// ── Price change percentage ───────────────────────────────────────────────

export async function getPriceChange(ticker, days = 1) {
  const entries = await priceHistoryManager.loadTicker(ticker)
  if (entries.length < 2) return null
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const cutoff = new Date(latest.date + 'T00:00:00')
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const prior = [...sorted].reverse().find(e => e.date <= cutoffStr)
  if (!prior) return null
  return ((latest.price - prior.price) / prior.price) * 100
}

// ── All stats in one call ─────────────────────────────────────────────────

export async function getPriceStats(ticker) {
  const [ma7, ma30, volatility, change1d, change7d, change30d] = await Promise.all([
    getMovingAverage(ticker, 7),
    getMovingAverage(ticker, 30),
    getVolatility(ticker, 30),
    getPriceChange(ticker, 1),
    getPriceChange(ticker, 7),
    getPriceChange(ticker, 30),
  ])
  return { ma7, ma30, volatility, change1d, change7d, change30d }
}
