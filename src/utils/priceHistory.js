// ── PriceHistoryManager ──────────────────────────────────────────────────
// Efficient price history storage with:
// - Batch writes: collect updates, write once per minute
// - Lazy loading per ticker (only load when needed)
// - Smart compression: 1 entry per week for data older than 30 days
// - Fallback to IndexedDB when localStorage is full
// - Data integrity checks with schema validation
// - Export/import for archiving

const PRICE_HISTORY_KEY_PREFIX = 'priceHistory_'
const LEGACY_PRICE_HISTORY_KEY = 'priceHistory'
const MAX_HISTORY_PER_TICKER = 90
const BATCH_INTERVAL_MS = 60_000 // flush pending writes once per minute
const COMPRESSION_THRESHOLD_DAYS = 30

// ── Schema validation ────────────────────────────────────────────────────

function isValidEntry(entry) {
  return (
    entry &&
    typeof entry === 'object' &&
    typeof entry.date === 'string' &&
    entry.date.match(/^\d{4}-\d{2}-\d{2}$/) &&
    typeof entry.price === 'number' &&
    isFinite(entry.price)
  )
}

function isValidTicker(ticker) {
  return typeof ticker === 'string' && ticker.length > 0 && ticker.length <= 20
}

// ── IndexedDB fallback ──────────────────────────────────────────────────

let _idbPromise = null

function getIDB() {
  if (_idbPromise) return _idbPromise
  _idbPromise = new Promise((resolve) => {
    if (!('indexedDB' in globalThis)) return resolve(null)
    const req = indexedDB.open('priceHistory', 1)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('tickers')) {
        db.createObjectStore('tickers', { keyPath: 'ticker' })
      }
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = () => resolve(null) // non-fatal — fall back gracefully
  })
  return _idbPromise
}

async function idbGet(ticker) {
  const db = await getIDB()
  if (!db) return null
  return new Promise((resolve) => {
    const tx = db.transaction('tickers', 'readonly')
    const req = tx.objectStore('tickers').get(ticker)
    req.onsuccess = () => resolve(req.result?.entries ?? null)
    req.onerror = () => resolve(null)
  })
}

async function idbSet(ticker, entries) {
  const db = await getIDB()
  if (!db) return false
  return new Promise((resolve) => {
    const tx = db.transaction('tickers', 'readwrite')
    tx.objectStore('tickers').put({ ticker, entries })
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
  })
}

async function idbGetAll() {
  const db = await getIDB()
  if (!db) return {}
  return new Promise((resolve) => {
    const tx = db.transaction('tickers', 'readonly')
    const req = tx.objectStore('tickers').getAll()
    req.onsuccess = () => {
      const result = {}
      for (const row of req.result) result[row.ticker] = row.entries
      resolve(result)
    }
    req.onerror = () => resolve({})
  })
}

// ── Compression ──────────────────────────────────────────────────────────

function compressOldEntries(entries) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - COMPRESSION_THRESHOLD_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const recent = entries.filter(e => e.date >= cutoffStr)
  const old = entries.filter(e => e.date < cutoffStr)

  if (old.length === 0) return entries

  // Keep one entry per week (the last one in each week)
  const byWeek = {}
  for (const e of old) {
    const d = new Date(e.date + 'T00:00:00')
    const day = d.getDay()
    // ISO week: align to Monday
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((day + 6) % 7))
    const weekKey = monday.toISOString().slice(0, 10)
    if (!byWeek[weekKey] || e.date > byWeek[weekKey].date) {
      byWeek[weekKey] = e
    }
  }

  return [...Object.values(byWeek).sort((a, b) => a.date.localeCompare(b.date)), ...recent]
}

// ── PriceHistoryManager class ────────────────────────────────────────────

class PriceHistoryManager {
  constructor() {
    this._pendingWrites = {} // ticker -> entries (dirty)
    this._loadedTickers = {} // ticker -> entries (clean cache)
    this._useIDB = {} // ticker -> bool (whether stored in IndexedDB)
    this._flushTimer = null
    this._migratedLegacy = false
  }

  // ── Migration from legacy flat storage ────────────────────────────────

  _migrateLegacy() {
    if (this._migratedLegacy) return
    this._migratedLegacy = true
    try {
      const raw = localStorage.getItem(LEGACY_PRICE_HISTORY_KEY)
      if (!raw) return
      const legacy = JSON.parse(raw)
      if (typeof legacy !== 'object' || Array.isArray(legacy)) return
      for (const [ticker, entries] of Object.entries(legacy)) {
        if (!isValidTicker(ticker)) continue
        const valid = Array.isArray(entries) ? entries.filter(isValidEntry) : []
        if (valid.length > 0) {
          // Only write if no per-ticker key exists yet
          const key = PRICE_HISTORY_KEY_PREFIX + ticker
          if (!localStorage.getItem(key)) {
            try {
              localStorage.setItem(key, JSON.stringify(valid))
            } catch {
              // Quota exceeded — will fall back to IndexedDB on next read
            }
          }
        }
      }
      // Remove legacy key after migration
      localStorage.removeItem(LEGACY_PRICE_HISTORY_KEY)
    } catch {
      // Migration failure is non-fatal
    }
  }

  // ── Load history for a single ticker ─────────────────────────────────

  async loadTicker(ticker) {
    if (!isValidTicker(ticker)) return []
    if (this._loadedTickers[ticker]) return this._loadedTickers[ticker]
    if (this._pendingWrites[ticker]) return this._pendingWrites[ticker]

    this._migrateLegacy()

    // Try localStorage first
    try {
      const raw = localStorage.getItem(PRICE_HISTORY_KEY_PREFIX + ticker)
      if (raw) {
        const entries = JSON.parse(raw)
        if (Array.isArray(entries)) {
          const valid = entries.filter(isValidEntry)
          this._loadedTickers[ticker] = valid
          return valid
        }
      }
    } catch {
      // Ignore parse errors
    }

    // Try IndexedDB
    const idbEntries = await idbGet(ticker)
    if (idbEntries && Array.isArray(idbEntries)) {
      const valid = idbEntries.filter(isValidEntry)
      this._loadedTickers[ticker] = valid
      this._useIDB[ticker] = true
      return valid
    }

    this._loadedTickers[ticker] = []
    return []
  }

  // ── Record a price snapshot ──────────────────────────────────────────

  async recordPrice(ticker, price) {
    if (!isValidTicker(ticker)) return
    if (typeof price !== 'number' || !isFinite(price)) return

    const today = new Date().toISOString().slice(0, 10)
    const entries = await this.loadTicker(ticker)
    const copy = [...entries]

    const last = copy[copy.length - 1]
    if (last && last.date === today) {
      copy[copy.length - 1] = { date: today, price }
    } else {
      copy.push({ date: today, price })
    }

    // Trim and compress
    const compressed = compressOldEntries(copy)
    const trimmed = compressed.length > MAX_HISTORY_PER_TICKER
      ? compressed.slice(-MAX_HISTORY_PER_TICKER)
      : compressed

    this._loadedTickers[ticker] = trimmed
    this._pendingWrites[ticker] = trimmed

    this._scheduleBatchFlush()
  }

  // ── Batch flush ──────────────────────────────────────────────────────

  _scheduleBatchFlush() {
    if (this._flushTimer) return
    this._flushTimer = setTimeout(() => {
      this._flushTimer = null
      this.flushPendingWrites()
    }, BATCH_INTERVAL_MS)
  }

  async flushPendingWrites() {
    const pending = { ...this._pendingWrites }
    this._pendingWrites = {}

    for (const [ticker, entries] of Object.entries(pending)) {
      await this._writeTicker(ticker, entries)
    }
  }

  async _writeTicker(ticker, entries) {
    // If already stored in IndexedDB, keep it there
    if (this._useIDB[ticker]) {
      await idbSet(ticker, entries)
      return
    }

    try {
      localStorage.setItem(PRICE_HISTORY_KEY_PREFIX + ticker, JSON.stringify(entries))
    } catch (e) {
      // localStorage quota exceeded — fall back to IndexedDB
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        this._useIDB[ticker] = true
        await idbSet(ticker, entries)
      }
    }
  }

  // ── Query API ────────────────────────────────────────────────────────

  async getPrice(ticker, date) {
    const entries = await this.loadTicker(ticker)
    if (!date) {
      const last = entries[entries.length - 1]
      return last ? last.price : null
    }
    const entry = entries.find(e => e.date === date)
    return entry ? entry.price : null
  }

  async getPriceRange(ticker, startDate, endDate) {
    const entries = await this.loadTicker(ticker)
    return entries.filter(e => e.date >= startDate && e.date <= endDate)
  }

  async getAveragePrice(ticker, startDate, endDate) {
    const range = await this.getPriceRange(ticker, startDate, endDate)
    if (range.length === 0) return null
    return range.reduce((sum, e) => sum + e.price, 0) / range.length
  }

  // ── Export / Import ──────────────────────────────────────────────────

  async exportAll() {
    const lsData = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(PRICE_HISTORY_KEY_PREFIX)) {
        const ticker = key.slice(PRICE_HISTORY_KEY_PREFIX.length)
        try {
          lsData[ticker] = JSON.parse(localStorage.getItem(key))
        } catch { /* skip */ }
      }
    }
    const idbData = await idbGetAll()
    return { ...idbData, ...lsData }
  }

  async importAll(data) {
    if (typeof data !== 'object' || Array.isArray(data)) return
    for (const [ticker, entries] of Object.entries(data)) {
      if (!isValidTicker(ticker)) continue
      const valid = Array.isArray(entries) ? entries.filter(isValidEntry) : []
      if (valid.length > 0) {
        this._loadedTickers[ticker] = valid
        await this._writeTicker(ticker, valid)
      }
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

export const priceHistoryManager = new PriceHistoryManager()
