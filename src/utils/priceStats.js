// ── Price Analytics ───────────────────────────────────────────────────────

/**
 * Given an array of { date, price } entries, compute comprehensive stats.
 *
 * @param {Array<{date: string, price: number}>} entries - sorted oldest→newest
 * @returns {object} stats object
 */
export function calcPriceStats(entries) {
  if (!entries || entries.length === 0) return null

  const prices = entries.map(e => e.price)
  const n = prices.length

  // ── Basic high / low / average ─────────────────────────────────────────
  const high = Math.max(...prices)
  const low = Math.min(...prices)
  const sum = prices.reduce((a, b) => a + b, 0)
  const avg = sum / n

  // ── Volatility ─────────────────────────────────────────────────────────
  const variance = prices.reduce((acc, p) => acc + (p - avg) ** 2, 0) / (n > 1 ? n - 1 : 1)
  const stdDev = Math.sqrt(variance)
  const coefficientOfVariation = avg !== 0 ? (stdDev / avg) * 100 : 0

  // ── Moving averages ─────────────────────────────────────────────────────
  const sma7 = n >= 7 ? prices.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, n) : null
  const sma30 = n >= 30 ? prices.slice(-30).reduce((a, b) => a + b, 0) / Math.min(30, n) : null

  // ── Price changes ───────────────────────────────────────────────────────
  const currentPrice = prices[n - 1]

  // Daily % change (vs previous entry)
  const dailyChange = n >= 2
    ? ((currentPrice - prices[n - 2]) / prices[n - 2]) * 100
    : null

  // Weekly % change (vs entry ~7 entries ago)
  const weeklyEntry = n >= 7 ? prices[n - 7] : prices[0]
  const weeklyChange = n >= 2
    ? ((currentPrice - weeklyEntry) / weeklyEntry) * 100
    : null

  // Monthly % change (vs entry ~30 entries ago)
  const monthlyEntry = n >= 30 ? prices[n - 30] : prices[0]
  const monthlyChange = n >= 2
    ? ((currentPrice - monthlyEntry) / monthlyEntry) * 100
    : null

  // Total % change (first → last)
  const totalChange = prices[0] !== 0
    ? ((currentPrice - prices[0]) / prices[0]) * 100
    : null

  // ── CAGR ─────────────────────────────────────────────────────────────
  let cagr = null
  if (entries.length >= 2 && prices[0] !== 0) {
    const firstDate = new Date(entries[0].date + 'T00:00:00')
    const lastDate = new Date(entries[n - 1].date + 'T00:00:00')
    const years = (lastDate - firstDate) / (365.25 * 24 * 3600 * 1000)
    if (years > 0) {
      cagr = ((currentPrice / prices[0]) ** (1 / years) - 1) * 100
    }
  }

  return {
    high,
    low,
    avg,
    stdDev,
    coefficientOfVariation,
    sma7,
    sma30,
    dailyChange,
    weeklyChange,
    monthlyChange,
    totalChange,
    cagr,
    currentPrice,
    entryCount: n,
  }
}

/**
 * Filter entries to the last `days` calendar days.
 *
 * @param {Array<{date: string, price: number}>} entries
 * @param {number} days
 */
export function lastNDays(entries, days) {
  if (!entries) return []
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return entries.filter(e => e.date >= cutoffStr)
}
