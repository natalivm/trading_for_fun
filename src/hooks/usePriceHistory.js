import { useMemo, useState, useEffect, useRef } from 'react'
import { priceHistoryManager } from '../utils/priceHistoryManager'
import { getPriceStats } from '../utils/priceStats'

// ── usePrice ─────────────────────────────────────────────────────────────
// Get the latest recorded price for a ticker (synchronous read).

export function usePrice(ticker) {
  return useMemo(
    () => (ticker ? priceHistoryManager.getPrice(ticker) : null),
    [ticker]
  )
}

// ── usePriceHistory ───────────────────────────────────────────────────────
// Get historical price entries for a ticker over the last `days` days.

export function usePriceHistory(ticker, days = 30) {
  return useMemo(() => {
    if (!ticker) return []
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)
    return priceHistoryManager.getPriceRange(ticker, cutoffStr, today)
  }, [ticker, days])
}

// ── usePriceStats ─────────────────────────────────────────────────────────
// Get volatility, moving averages, and price change percentages.
// Refreshes every 5 minutes.

export function usePriceStats(ticker) {
  const [stats, setStats] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!ticker) return

    function refresh() {
      setStats(getPriceStats(ticker))
    }

    refresh()

    timerRef.current = setInterval(refresh, 5 * 60_000)

    return () => {
      clearInterval(timerRef.current)
    }
  }, [ticker])

  return stats
}

// ── usePriceHistoryActions ────────────────────────────────────────────────
// Stable references to record/export/import actions.

import { useCallback } from 'react'

export function usePriceHistoryActions() {
  const record = useCallback((ticker, price) => {
    priceHistoryManager.record(ticker, price)
  }, [])

  const exportData = useCallback(() => {
    return priceHistoryManager.exportData()
  }, [])

  const importData = useCallback((json) => {
    priceHistoryManager.importData(json)
  }, [])

  const getAllEntries = useCallback((ticker) => {
    return priceHistoryManager.getAllEntries(ticker)
  }, [])

  const getAveragePrice = useCallback((ticker) => {
    return priceHistoryManager.getAveragePrice(ticker)
  }, [])

  return { record, exportData, importData, getAllEntries, getAveragePrice }
}
