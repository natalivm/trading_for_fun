// ── Accent styles for Card component ────────────────────────────────────
export const ACCENT_STYLES = {
  emerald: 'border-emerald-500/20 hover:border-emerald-500/40',
  blue: 'border-blue-500/20 hover:border-blue-500/40',
  amber: 'border-amber-500/20 hover:border-amber-500/40',
  rose: 'border-rose-500/20 hover:border-rose-500/40',
  violet: 'border-violet-500/20 hover:border-violet-500/40',
}

// ── Currency symbols and FX rates ────────────────────────────────────────
export const CCY_SYMBOLS = { USD: '$', EUR: '€', CAD: 'C$', GBP: '£', CHF: 'CHF ' }

export function ccySym(currency) {
  return CCY_SYMBOLS[currency] || (currency ? currency + ' ' : '$')
}

export const FX_TO_USD = { USD: 1, EUR: 1.08, CAD: 0.73, GBP: 1.27, CHF: 1.13 }

export function toUSD(amount, currency) {
  return amount * (FX_TO_USD[currency] || 1)
}

// ── Fee rule: deduct $0.35 per transaction ───────────────────────────────
export const FEE_PER_TRANSACTION = 0.35
