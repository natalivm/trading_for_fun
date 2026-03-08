import { useCallback } from 'react'
import { priceHistoryManager } from '../utils/priceHistoryManager'

/**
 * React hook providing access to the price history system.
 *
 * Usage:
 *   const { record, getPrice, getPriceRange, getAveragePrice, getAllEntries, exportData, importData } = usePriceHistory()
 *
 * All returned functions are stable references (useCallback with no deps).
 */
export function usePriceHistory() {
  /** Record today's price for a ticker. */
  const record = useCallback((ticker, price) => {
    priceHistoryManager.record(ticker, price)
  }, [])

  /** Get the latest recorded price for a ticker, or null. */
  const getPrice = useCallback((ticker) => {
    return priceHistoryManager.getPrice(ticker)
  }, [])

  /**
   * Get price entries within a date range.
   * @param {string} ticker
   * @param {string} fromDate - YYYY-MM-DD (inclusive)
   * @param {string} toDate   - YYYY-MM-DD (inclusive)
   * @returns {{ date: string, price: number }[]}
   */
  const getPriceRange = useCallback((ticker, fromDate, toDate) => {
    return priceHistoryManager.getPriceRange(ticker, fromDate, toDate)
  }, [])

  /** Get the arithmetic average price across all history for a ticker, or null. */
  const getAveragePrice = useCallback((ticker) => {
    return priceHistoryManager.getAveragePrice(ticker)
  }, [])

  /** Get all recorded entries for a ticker in chronological order. */
  const getAllEntries = useCallback((ticker) => {
    return priceHistoryManager.getAllEntries(ticker)
  }, [])

  /** Export all price history as a JSON string for archiving / download. */
  const exportData = useCallback(() => {
    return priceHistoryManager.exportData()
  }, [])

  /**
   * Import price history from a previously exported JSON string.
   * Merges with existing data; newer entries win on duplicate dates.
   */
  const importData = useCallback((json) => {
    priceHistoryManager.importData(json)
  }, [])

  return { record, getPrice, getPriceRange, getAveragePrice, getAllEntries, exportData, importData }
}
