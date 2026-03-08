import { useState, useEffect, useRef, useCallback } from 'react'
import { priceHistoryManager } from '../utils/priceHistory'
import { calcPriceStats, lastNDays } from '../utils/priceStats'

// ── usePrice ──────────────────────────────────────────────────────────────
/**
 * Returns the most recently recorded cached price for a ticker.
 * Auto-refreshes whenever the manager records a new value.
 *
 * @param {string} ticker
 * @returns {number|null}
 */
export function usePrice(ticker) {
  const [price, setPrice] = useState(null)

  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    async function load() {
      const p = await priceHistoryManager.getPrice(ticker)
      if (!cancelled) setPrice(p)
    }
    load()
    return () => { cancelled = true }
  }, [ticker])

  return price
}

// ── usePriceHistory ───────────────────────────────────────────────────────
/**
 * Returns historical price entries for a ticker over the last `daysBack` days.
 *
 * @param {string} ticker
 * @param {number} [daysBack=90]
 * @returns {{ data: Array<{date:string,price:number}>, loading: boolean }}
 */
export function usePriceHistory(ticker, daysBack = 90) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    if (!ticker) return
    async function load() {
      setLoading(true)
      try {
        const entries = await priceHistoryManager.getHistory(ticker)
        const filtered = lastNDays(entries, daysBack)
        if (mountedRef.current) setData(filtered)
      } catch { /* silently ignore */ }
      if (mountedRef.current) setLoading(false)
    }
    await load()
  }, [ticker, daysBack])

  useEffect(() => {
    mountedRef.current = true
    async function run() { await refresh() }
    run()
    return () => { mountedRef.current = false }
  }, [refresh])

  return { data, loading, refresh }
}

// ── usePriceStats ─────────────────────────────────────────────────────────
/**
 * Returns computed price statistics for a ticker.
 *
 * @param {string} ticker
 * @returns {{ stats: object|null, loading: boolean }}
 */
export function usePriceStats(ticker) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const entries = await priceHistoryManager.getHistory(ticker)
        if (!cancelled) setStats(calcPriceStats(entries))
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [ticker])

  return { stats, loading }
}
