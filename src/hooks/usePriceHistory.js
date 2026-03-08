import { useState, useEffect, useCallback, useMemo } from 'react'
import priceHistoryManager from '../utils/priceHistoryManager'
import { priceStats, historicalVolatility, simpleMovingAverage } from '../utils/priceAnalytics'

/**
 * Hook to access price history for a single ticker.
 * Returns { history, stats, volatility, sma, loading, refresh }
 */
export function usePriceHistory(ticker, { from, to, smaPeriod = 20 } = {}) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!ticker) { setLoading(false); return }
    setLoading(true)
    try {
      const entries = await priceHistoryManager.getHistory(ticker, { from, to })
      setHistory(entries)
    } catch { /* ignore */ }
    setLoading(false)
  }, [ticker, from, to])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!ticker) { if (!cancelled) setLoading(false); return }
      try {
        const entries = await priceHistoryManager.getHistory(ticker, { from, to })
        if (!cancelled) setHistory(entries)
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [ticker, from, to])

  const stats = useMemo(() => priceStats(history), [history])
  const volatility = useMemo(() => historicalVolatility(history), [history])
  const sma = useMemo(() => simpleMovingAverage(history, smaPeriod), [history, smaPeriod])

  return { history, stats, volatility, sma, loading, refresh }
}

/**
 * Hook to access price history for multiple tickers at once.
 * Returns { histories, loading, refresh } where histories is { [ticker]: entries[] }
 */
export function usePriceHistories(tickers, options = {}) {
  const [histories, setHistories] = useState({})
  const [loading, setLoading] = useState(true)

  const tickersKey = tickers.join(',')

  const refresh = useCallback(async () => {
    if (!tickers || tickers.length === 0) { setLoading(false); return }
    setLoading(true)
    try {
      const results = await Promise.all(
        tickers.map(ticker => priceHistoryManager.getHistory(ticker, options).then(h => [ticker, h]))
      )
      setHistories(Object.fromEntries(results))
    } catch { /* ignore */ }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { histories, loading, refresh }
}

/**
 * Hook for price data export/import functionality.
 */
export function usePriceDataExport() {
  const exportData = useCallback(async () => {
    const data = await priceHistoryManager.exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `price-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const importData = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async e => {
        try {
          const data = JSON.parse(e.target.result)
          await priceHistoryManager.importAll(data)
          resolve(true)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      reader.readAsText(file)
    })
  }, [])

  return { exportData, importData }
}
