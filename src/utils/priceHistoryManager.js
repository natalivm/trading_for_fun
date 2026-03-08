// ── PriceHistoryManager ─────────────────────────────────────────────────
// Enhanced price history system with:
//   - Lazy loading (data loaded only on first access)
//   - Batch writes with debounce (avoids writing on every tick)
//   - Smart compression (1 entry/week for data >30 days old)
//   - IndexedDB fallback when localStorage quota is exceeded
//   - Query API: getPrice, getPriceRange, getAveragePrice
//   - Export / import for archiving

const PRICE_HISTORY_KEY = 'priceHistory'
const INDEXED_DB_NAME = 'tradingPriceHistory'
const INDEXED_DB_STORE = 'priceHistory'
const WRITE_DEBOUNCE_MS = 2000
const MAX_ENTRIES_BEFORE_COMPRESS = 120

class PriceHistoryManager {
  constructor() {
    this._data = null       // null = not yet loaded (lazy)
    this._dirty = false
    this._writeTimer = null
    this._idbAvailable = null  // null = unknown, true/false after first check
  }

  // ── Lazy load ────────────────────────────────────────────────────────
  _ensureLoaded() {
    if (this._data !== null) return
    try {
      this._data = JSON.parse(localStorage.getItem(PRICE_HISTORY_KEY)) || {}
    } catch {
      this._data = {}
    }
  }

  // ── Batch write with debounce ─────────────────────────────────────────
  _scheduleSave() {
    this._dirty = true
    if (this._writeTimer) clearTimeout(this._writeTimer)
    this._writeTimer = setTimeout(() => this._flush(), WRITE_DEBOUNCE_MS)
  }

  _flush() {
    if (!this._dirty || this._data === null) return
    const json = JSON.stringify(this._data)
    try {
      localStorage.setItem(PRICE_HISTORY_KEY, json)
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        this._saveToIndexedDB(this._data).catch(() => {})
      }
    }
    this._dirty = false
    this._writeTimer = null
  }

  // ── Smart compression ─────────────────────────────────────────────────
  // Data >30 days old → keep 1 entry per calendar week (latest price)
  // Data 7–30 days old → keep all daily entries
  // Data <7 days old → keep all entries
  _compress(entries) {
    const now = new Date()
    const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString().slice(0, 10)
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10)

    const recent = entries.filter(e => e.date >= sevenDaysAgo)
    const mid = entries.filter(e => e.date >= thirtyDaysAgo && e.date < sevenDaysAgo)
    const old = entries.filter(e => e.date < thirtyDaysAgo)

    // Keep only the latest entry per ISO week for old data
    const weekMap = {}
    for (const e of old) {
      const d = new Date(e.date + 'T00:00:00')
      const yearStart = new Date(d.getFullYear(), 0, 1)
      const week = Math.floor((d - yearStart) / (7 * 86400000))
      const key = `${d.getFullYear()}-W${week}`
      if (!weekMap[key] || e.date > weekMap[key].date) {
        weekMap[key] = e
      }
    }
    const compressedOld = Object.values(weekMap).sort((a, b) => a.date < b.date ? -1 : 1)

    return [...compressedOld, ...mid, ...recent]
  }

  // ── IndexedDB fallback ────────────────────────────────────────────────
  async _getIDB() {
    if (this._idbAvailable === false) return null
    if (typeof window === 'undefined' || !window.indexedDB) {
      this._idbAvailable = false
      return null
    }
    return new Promise((resolve) => {
      const req = indexedDB.open(INDEXED_DB_NAME, 1)
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(INDEXED_DB_STORE)
      }
      req.onsuccess = (e) => {
        this._idbAvailable = true
        resolve(e.target.result)
      }
      req.onerror = () => {
        this._idbAvailable = false
        resolve(null)
      }
    })
  }

  async _saveToIndexedDB(data) {
    const db = await this._getIDB()
    if (!db) return
    return new Promise((resolve, reject) => {
      const tx = db.transaction(INDEXED_DB_STORE, 'readwrite')
      tx.objectStore(INDEXED_DB_STORE).put(data, 'history')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  async _loadFromIndexedDB() {
    const db = await this._getIDB()
    if (!db) return null
    return new Promise((resolve) => {
      const tx = db.transaction(INDEXED_DB_STORE, 'readonly')
      const req = tx.objectStore(INDEXED_DB_STORE).get('history')
      req.onsuccess = (e) => resolve(e.target.result || null)
      req.onerror = () => resolve(null)
    })
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Record a price snapshot for a ticker.
   * Only one entry per day is kept; calling multiple times on the same day
   * updates the existing entry.
   */
  record(ticker, price) {
    this._ensureLoaded()
    const today = new Date().toISOString().slice(0, 10)
    if (!this._data[ticker]) this._data[ticker] = []
    const entries = this._data[ticker]
    const last = entries[entries.length - 1]
    if (last && last.date === today) {
      last.price = price
    } else {
      entries.push({ date: today, price })
      if (entries.length > MAX_ENTRIES_BEFORE_COMPRESS) {
        this._data[ticker] = this._compress(entries)
      }
    }
    this._scheduleSave()
  }

  /**
   * Get the latest recorded price for a ticker.
   * Returns null if no history exists.
   */
  getPrice(ticker) {
    this._ensureLoaded()
    const entries = this._data[ticker]
    if (!entries || entries.length === 0) return null
    return entries[entries.length - 1].price
  }

  /**
   * Get all price entries for a ticker within [fromDate, toDate] (YYYY-MM-DD, inclusive).
   * Returns an array of { date, price } objects.
   */
  getPriceRange(ticker, fromDate, toDate) {
    this._ensureLoaded()
    const entries = this._data[ticker]
    if (!entries) return []
    return entries.filter(e => e.date >= fromDate && e.date <= toDate)
  }

  /**
   * Get the arithmetic average price across all recorded history for a ticker.
   * Returns null if no history exists.
   */
  getAveragePrice(ticker) {
    this._ensureLoaded()
    const entries = this._data[ticker]
    if (!entries || entries.length === 0) return null
    const sum = entries.reduce((s, e) => s + e.price, 0)
    return sum / entries.length
  }

  /**
   * Get all recorded entries for a ticker in chronological order.
   */
  getAllEntries(ticker) {
    this._ensureLoaded()
    return (this._data[ticker] || []).slice()
  }

  /**
   * Export all price history as a JSON string suitable for archiving.
   */
  exportData() {
    this._ensureLoaded()
    return JSON.stringify(this._data, null, 2)
  }

  /**
   * Import price history from a JSON string previously exported via exportData().
   * Merges with existing data; newer entries win on duplicate dates.
   */
  importData(json) {
    try {
      const imported = JSON.parse(json)
      this._ensureLoaded()
      for (const [ticker, entries] of Object.entries(imported)) {
        if (!Array.isArray(entries)) continue
        if (!this._data[ticker]) {
          this._data[ticker] = entries
        } else {
          const existing = new Map(this._data[ticker].map(e => [e.date, e]))
          for (const e of entries) {
            existing.set(e.date, e)
          }
          this._data[ticker] = [...existing.values()].sort((a, b) => a.date < b.date ? -1 : 1)
        }
      }
      this._scheduleSave()
    } catch { /* invalid JSON — silently ignore */ }
  }

  /**
   * Force an immediate write to storage (bypasses debounce).
   * Useful before the page unloads.
   */
  flush() {
    if (this._writeTimer) {
      clearTimeout(this._writeTimer)
      this._writeTimer = null
    }
    this._flush()
  }
}

export const priceHistoryManager = new PriceHistoryManager()
