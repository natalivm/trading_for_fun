// ── PriceHistoryManager ──────────────────────────────────────────────────
// Features:
//  - Batch writes (once per minute)
//  - Lazy loading per ticker
//  - Smart compression (daily → weekly after 30 days)
//  - IndexedDB fallback when localStorage quota exceeded
//  - Query API: getHistory(), getLatest()
//  - Backward compatibility with existing 'priceHistory' localStorage key

const PRICE_HISTORY_KEY = 'priceHistory'
const PRICE_HISTORY_META_KEY = 'priceHistoryMeta'
const BATCH_INTERVAL_MS = 60_000 // 1 minute
const DAILY_RETENTION_DAYS = 30
const IDB_DB_NAME = 'tradingPriceHistory'
const IDB_STORE_NAME = 'prices'

// ── IndexedDB helpers ────────────────────────────────────────────────────

function openIDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return }
    const req = indexedDB.open(IDB_DB_NAME, 1)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME)
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = () => resolve(null) // fallback gracefully
  })
}

async function idbGet(db, key) {
  if (!db) return null
  return new Promise(resolve => {
    const tx = db.transaction(IDB_STORE_NAME, 'readonly')
    const req = tx.objectStore(IDB_STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => resolve(null)
  })
}

async function idbSet(db, key, value) {
  if (!db) return false
  return new Promise(resolve => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite')
    const req = tx.objectStore(IDB_STORE_NAME).put(value, key)
    req.onsuccess = () => resolve(true)
    req.onerror = () => resolve(false)
  })
}

// ── Compression: collapse daily entries older than DAILY_RETENTION_DAYS ──

function compressHistory(entries) {
  if (!entries || entries.length === 0) return []
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - DAILY_RETENTION_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const recent = entries.filter(e => e.date >= cutoffStr)
  const old = entries.filter(e => e.date < cutoffStr)

  if (old.length === 0) return recent

  // Group old entries by ISO week (YYYY-Www)
  const weekMap = {}
  for (const e of old) {
    const d = new Date(e.date + 'T00:00:00')
    const year = d.getFullYear()
    // ISO week number
    const jan4 = new Date(year, 0, 4)
    const week = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7)
    const key = `${year}-W${String(week).padStart(2, '0')}`
    if (!weekMap[key]) weekMap[key] = { date: key, prices: [], count: 0 }
    weekMap[key].prices.push(e.price)
    weekMap[key].count++
  }

  const compressed = Object.values(weekMap).map(w => ({
    date: w.date,
    price: w.prices.reduce((a, b) => a + b, 0) / w.prices.length,
    count: w.count,
    compressed: true,
  })).sort((a, b) => a.date.localeCompare(b.date))

  return [...compressed, ...recent]
}

// ── PriceHistoryManager class ────────────────────────────────────────────

class PriceHistoryManager {
  constructor() {
    this._pending = {} // { ticker: { date, price } }
    this._cache = {}   // { ticker: entries[] } — lazy loaded
    this._db = null
    this._flushTimer = null
    this._initialized = false
    this._initPromise = this._init()
  }

  async _init() {
    this._db = await openIDB()
    this._initialized = true
  }

  async _ready() {
    if (!this._initialized) await this._initPromise
  }

  // ── Migrate legacy localStorage data ──────────────────────────────────
  async migrate() {
    await this._ready()
    const meta = this._getMeta()
    if (meta.migrated) return

    try {
      const raw = localStorage.getItem(PRICE_HISTORY_KEY)
      if (!raw) { this._setMeta({ ...meta, migrated: true }); return }
      const legacy = JSON.parse(raw)
      for (const [ticker, entries] of Object.entries(legacy)) {
        if (!Array.isArray(entries)) continue
        const existing = await this._loadTicker(ticker)
        const existingDates = new Set(existing.map(e => e.date))
        const merged = [...existing]
        for (const e of entries) {
          if (!existingDates.has(e.date)) merged.push(e)
        }
        merged.sort((a, b) => a.date.localeCompare(b.date))
        await this._saveTicker(ticker, compressHistory(merged))
      }
    } catch { /* ignore migration errors */ }

    this._setMeta({ ...meta, migrated: true })
  }

  _getMeta() {
    try { return JSON.parse(localStorage.getItem(PRICE_HISTORY_META_KEY)) || {} } catch { return {} }
  }

  _setMeta(meta) {
    try { localStorage.setItem(PRICE_HISTORY_META_KEY, JSON.stringify(meta)) } catch { /* ignore */ }
  }

  // ── Load/save per-ticker data ──────────────────────────────────────────
  async _loadTicker(ticker) {
    if (this._cache[ticker]) return this._cache[ticker]

    // Try IDB first, then localStorage
    let entries = null
    if (this._db) {
      entries = await idbGet(this._db, `ph_${ticker}`)
    }
    if (!entries) {
      try {
        const raw = localStorage.getItem(`ph_${ticker}`)
        entries = raw ? JSON.parse(raw) : null
      } catch { /* ignore */ }
    }

    this._cache[ticker] = entries || []
    return this._cache[ticker]
  }

  async _saveTicker(ticker, entries) {
    this._cache[ticker] = entries
    let savedToIDB = false
    if (this._db) {
      savedToIDB = await idbSet(this._db, `ph_${ticker}`, entries)
    }
    if (!savedToIDB) {
      try {
        localStorage.setItem(`ph_${ticker}`, JSON.stringify(entries))
      } catch {
        // localStorage quota exceeded — try to free space
        this._evictOldEntries(ticker)
      }
    }
  }

  _evictOldEntries(skipTicker) {
    // Remove localStorage keys for tickers not recently accessed
    const keysToDelete = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('ph_') && key !== `ph_${skipTicker}`) {
        keysToDelete.push(key)
      }
    }
    // Remove half of them (oldest cache entries)
    keysToDelete.slice(0, Math.ceil(keysToDelete.length / 2)).forEach(k => {
      localStorage.removeItem(k)
      const ticker = k.slice(3)
      delete this._cache[ticker]
    })
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /** Record a price for a ticker (batched — written at most once per minute) */
  record(ticker, price) {
    const today = new Date().toISOString().slice(0, 10)
    this._pending[ticker] = { date: today, price }
    this._scheduleBatch()
  }

  _scheduleBatch() {
    if (this._flushTimer) return
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null
      this.flush()
    }, BATCH_INTERVAL_MS)
  }

  /** Flush pending writes immediately */
  async flush() {
    await this._ready()
    const pending = { ...this._pending }
    this._pending = {}

    for (const [ticker, { date, price }] of Object.entries(pending)) {
      const entries = await this._loadTicker(ticker)
      const last = entries[entries.length - 1]
      if (last && last.date === date) {
        last.price = price
      } else {
        entries.push({ date, price })
      }
      const compressed = compressHistory(entries)
      await this._saveTicker(ticker, compressed)
    }
  }

  /** Get price history for a ticker with optional date range */
  async getHistory(ticker, { from, to } = {}) {
    await this._ready()
    let entries = await this._loadTicker(ticker)
    if (from) entries = entries.filter(e => e.date >= from)
    if (to) entries = entries.filter(e => e.date <= to)
    return entries
  }

  /** Get the latest recorded price for a ticker */
  async getLatest(ticker) {
    const entries = await this._loadTicker(ticker)
    return entries.length > 0 ? entries[entries.length - 1] : null
  }

  /** Get all tickers that have history data */
  async getAllTickers() {
    await this._ready()
    const tickers = new Set()

    // From cache
    for (const ticker of Object.keys(this._cache)) tickers.add(ticker)

    // From IDB
    if (this._db) {
      await new Promise(resolve => {
        const tx = this._db.transaction(IDB_STORE_NAME, 'readonly')
        const req = tx.objectStore(IDB_STORE_NAME).getAllKeys()
        req.onsuccess = () => {
          for (const key of req.result) {
            if (key.startsWith('ph_')) tickers.add(key.slice(3))
          }
          resolve()
        }
        req.onerror = resolve
      })
    }

    // From localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('ph_')) tickers.add(key.slice(3))
    }

    return Array.from(tickers)
  }

  /** Export all history as a JSON-serializable object */
  async exportAll() {
    const tickers = await this.getAllTickers()
    const result = {}
    for (const ticker of tickers) {
      result[ticker] = await this.getHistory(ticker)
    }
    return result
  }

  /** Import history from an exported object (merges with existing data) */
  async importAll(data) {
    await this._ready()
    for (const [ticker, entries] of Object.entries(data)) {
      if (!Array.isArray(entries)) continue
      const existing = await this._loadTicker(ticker)
      const existingDates = new Set(existing.map(e => e.date))
      const merged = [...existing]
      for (const e of entries) {
        if (!existingDates.has(e.date)) merged.push(e)
      }
      merged.sort((a, b) => a.date.localeCompare(b.date))
      await this._saveTicker(ticker, compressHistory(merged))
    }
  }
}

// Singleton instance
const priceHistoryManager = new PriceHistoryManager()

export default priceHistoryManager
export { PriceHistoryManager, compressHistory }
