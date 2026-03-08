import { toUSD } from './constants'

// Module-level position state, updated via setPositionData
let _longPositions = []
let _shortPositions = []
let _closedPositions = []

// ── Calculate % gain/loss for a position ────────────────────────────────
export function calcPnlPercent(position, isShort = false) {
  if (position.profitPercent != null && position.profitPercent !== 0) {
    return position.profitPercent
  }
  if (position.status === 'closed' && position.exitPrice && position.entryPrice) {
    const raw = ((position.exitPrice - position.entryPrice) / position.entryPrice) * 100
    return isShort ? -raw : raw
  }
  const totalCost = (position.entryPrice || 0) * (position.quantity || 0)
  if (totalCost > 0) {
    // Use unrealizedPnL, realizedPnL, or profitDollar
    const pnl = position.unrealizedPnL || position.realizedPnL || position.profitDollar
    if (pnl != null) return (pnl / totalCost) * 100
    // Derive from marketValue if available
    if (position.marketValue) return ((position.marketValue - totalCost) / totalCost) * 100
  }
  return null
}

export function setPositionData({ longPositions, shortPositions, closedLongPositions, closedShortPositions }) {
  _longPositions = longPositions
  _shortPositions = shortPositions
  _closedPositions = [...closedLongPositions, ...closedShortPositions]
}

export function calcMyCapital() {
  // Sum of open long positions only (your own money)
  const closedKeys = new Set(_closedPositions.map(c => `${c.ticker}|${c.openDate}`))
  return _longPositions
    .filter(p => !closedKeys.has(`${p.ticker}|${p.openDate}`))
    .reduce((sum, p) => sum + toUSD(p.entryPrice * p.quantity, p.currency), 0)
}

export function calcCurrentlyInvested() {
  // Sum of all open positions — longs + shorts (total capital deployed)
  const closedKeys = new Set(_closedPositions.map(c => `${c.ticker}|${c.openDate}`))
  const allOpen = [..._longPositions, ..._shortPositions]
  return allOpen
    .filter(p => !closedKeys.has(`${p.ticker}|${p.openDate}`))
    .reduce((sum, p) => sum + toUSD(p.entryPrice * p.quantity, p.currency), 0)
}

export function calcProfit() {
  return _closedPositions.reduce((sum, p) => {
    const pnl = (p.profitDollar || 0) - (p.fees || 0)
    return sum + toUSD(pnl, p.currency)
  }, 0)
}

export function calcDailyPnL() {
  const allOpen = [..._longPositions, ..._shortPositions].filter(p => p.status === 'open')
  return allOpen.reduce((sum, p) => sum + (p.dailyPnL || 0), 0)
}
