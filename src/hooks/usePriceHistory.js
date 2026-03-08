import { useState, useEffect, useRef } from 'react'
import { priceHistoryManager } from '../utils/priceHistory'
import { getPriceStats } from '../utils/priceStats'

// ── usePrice ─────────────────────────────────────────────────────────────
// Get the latest recorded price for a ticker, with automatic refresh when
// new snapshots are recorded.

export function usePrice(ticker) {
  const [price, setPrice] = useState(null)

  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    priceHistoryManager.getPrice(ticker).then(p => {
      if (!cancelled) setPrice(p)
    })
    return () => { cancelled = true }
  }, [ticker])

  return price
}

// ── usePriceHistory ───────────────────────────────────────────────────────
// Get historical price entries for a ticker over the last `days` days.

export function usePriceHistory(ticker, days = 30) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    priceHistoryManager.getPriceRange(
      ticker,
      cutoffStr,
      new Date().toISOString().slice(0, 10)
    ).then(entries => { if (!cancelled) setHistory(entries) })
    return () => { cancelled = true }
  }, [ticker, days])

  return history
}

// ── usePriceStats ─────────────────────────────────────────────────────────
// Get volatility, moving averages, and price change percentages.

export function usePriceStats(ticker) {
  const [stats, setStats] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!ticker) return
    let cancelled = false

    async function fetch() {
      const data = await getPriceStats(ticker)
      if (!cancelled) setStats(data)
    }

    fetch()

    // Refresh stats every 5 minutes
    timerRef.current = setInterval(fetch, 5 * 60_000)

    return () => {
      cancelled = true
      clearInterval(timerRef.current)
    }
  }, [ticker])

  return stats
}
