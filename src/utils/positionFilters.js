// ── Filter/grouping utilities for positions ──────────────────────────────

// Filter to only include 2026 closed positions
export function filterClosed2026(positions) {
  return positions.filter((p) => {
    const date = p.closeDate || p.openDate || ''
    return date.startsWith('2026')
  })
}

// ── Group fills with the same ticker+openDate into a single trade ────────

export function groupFills(positions) {
  const grouped = {}
  for (const p of positions) {
    const key = `${p.ticker}|${p.openDate || ''}`
    if (!grouped[key]) {
      grouped[key] = {
        ...p,
        _totalCost: p.entryPrice * p.quantity,
        _totalExitCost: (p.exitPrice || 0) * p.quantity,
        _totalQty: p.quantity,
        _totalDailyPnL: p.dailyPnL || 0,
        _totalUnrealizedPnL: p.unrealizedPnL || 0,
        _totalRealizedPnL: p.realizedPnL || 0,
        _totalProfitDollar: p.profitDollar || 0,
        _totalFees: p.fees || 0,
        _totalMarketValue: p.marketValue || 0,
        _hasExit: p.exitPrice != null,
        _hasProfitDollar: p.profitDollar != null,
      }
    } else {
      const g = grouped[key]
      g._totalCost += p.entryPrice * p.quantity
      g._totalExitCost += (p.exitPrice || 0) * p.quantity
      g._totalQty += p.quantity
      g._totalDailyPnL += p.dailyPnL || 0
      g._totalUnrealizedPnL += p.unrealizedPnL || 0
      g._totalRealizedPnL += p.realizedPnL || 0
      g._totalProfitDollar += p.profitDollar || 0
      g._totalFees += p.fees || 0
      g._totalMarketValue += p.marketValue || 0
      if (p.exitPrice != null) g._hasExit = true
      if (p.profitDollar != null) g._hasProfitDollar = true
    }
  }
  return Object.values(grouped).map(g => ({
    ...g,
    entryPrice: g._totalCost / g._totalQty,
    exitPrice: g._hasExit ? g._totalExitCost / g._totalQty : undefined,
    quantity: g._totalQty,
    dailyPnL: g._totalDailyPnL || undefined,
    unrealizedPnL: g._totalUnrealizedPnL || undefined,
    realizedPnL: g._totalRealizedPnL || undefined,
    profitDollar: g._hasProfitDollar ? g._totalProfitDollar : undefined,
    profitPercent: undefined, // recalculated from aggregated values
    fees: g._totalFees || undefined,
    marketValue: g._totalMarketValue || undefined,
  }))
}

// A "trade" = positions with same ticker opened on the same date.
// Closed positions are already complete trades — keep as individual cards.
export function groupIntoTrades(openPositions, closedPositions) {
  return [...groupFills(closedPositions), ...groupFills(openPositions)]
}
