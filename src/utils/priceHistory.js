// ── PriceHistoryManager ───────────────────────────────────────────────────
// Robust price history tracking with:
//   • Batch writes (flush once per minute)
//   • Lazy loading (load ticker data only when accessed)
//   • Smart compression (daily for 30 days, then weekly)
//   • IndexedDB fallback when localStorage exceeds 5MB
//   • Migration from old storage format

const LEGACY_KEY = 'priceHistory'
const LS_KEY = 'phm_v2'
const LS_MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const DAILY_RETENTION_DAYS = 30
const FLUSH_INTERVAL_MS = 60_000 // 1 minute

// ── IndexedDB helpers ─────────────────────────────────────────────────────

function openIDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no idb'))
    const req = indexedDB.open('priceHistory', 1)
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('tickers', { keyPath: 'ticker' })
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror = e => reject(e.target.error)
  })
}

async function idbGet(ticker) {
  try {
    const db = await openIDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tickers', 'readonly')
      const req = tx.objectStore('tickers').get(ticker)
      req.onsuccess = () => resolve(req.result?.data ?? null)
      req.onerror = e => reject(e.target.error)
    })
  } catch { return null }
}

async function idbPut(ticker, data) {
  try {
    const db = await openIDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tickers', 'readwrite')
      tx.objectStore('tickers').put({ ticker, data })
      tx.oncomplete = () => resolve()
      tx.onerror = e => reject(e.target.error)
    })
  } catch { /* silent */ }
}

async function idbGetAll() {
  try {
    const db = await openIDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('tickers', 'readonly')
      const req = tx.objectStore('tickers').getAll()
      req.onsuccess = () => {
        const out = {}
        for (const row of req.result) out[row.ticker] = row.data
        resolve(out)
      }
      req.onerror = e => reject(e.target.error)
    })
  } catch { return {} }
}

// ── Compression ───────────────────────────────────────────────────────────

function compressEntries(entries) {
  if (!entries || entries.length === 0) return []
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - DAILY_RETENTION_DAYS)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // Split into recent (keep daily) and old (compress to weekly)
  const recent = entries.filter(e => e.date >= cutoffStr)
  const old = entries.filter(e => e.date < cutoffStr)

  // Compress old entries to weekly averages
  const weekBuckets = {}
  for (const e of old) {
    const d = new Date(e.date + 'T00:00:00')
    // ISO week start (Monday)
    const dow = d.getDay() || 7 // 1=Mon ... 7=Sun
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - (dow - 1))
    const key = weekStart.toISOString().slice(0, 10)
    if (!weekBuckets[key]) weekBuckets[key] = []
    weekBuckets[key].push(e.price)
  }

  const compressed = Object.entries(weekBuckets).map(([date, prices]) => ({
    date,
    price: prices.reduce((a, b) => a + b, 0) / prices.length,
    weekly: true,
  })).sort((a, b) => a.date.localeCompare(b.date))

  return [...compressed, ...recent]
}

// ── PriceHistoryManager class ─────────────────────────────────────────────

class PriceHistoryManager {
  constructor() {
    this._cache = {}       // ticker -> entries[]
    this._dirty = new Set() // tickers with unsaved changes
    this._loaded = new Set() // tickers whose data has been loaded
    this._useIDB = false
    this._flushTimer = null
    this._migrated = false
  }

  // ── Init / migration ────────────────────────────────────────────────────

  async _ensureMigrated() {
    if (this._migrated) return
    this._migrated = true
    try {
      const legacy = localStorage.getItem(LEGACY_KEY)
      if (!legacy) return
      const data = JSON.parse(legacy)
      for (const [ticker, entries] of Object.entries(data)) {
        if (!Array.isArray(entries)) continue
        // Legacy format: { date, price }
        this._cache[ticker] = entries.map(e => ({ date: e.date, price: e.price }))
        this._dirty.add(ticker)
        this._loaded.add(ticker)
      }
      await this._flush()
      localStorage.removeItem(LEGACY_KEY)
    } catch { /* ignore migration errors */ }
  }

  // ── Load ticker lazily ──────────────────────────────────────────────────

  async _load(ticker) {
    if (this._loaded.has(ticker)) return
    this._loaded.add(ticker)
    // Try localStorage first
    try {
      const raw = localStorage.getItem(`${LS_KEY}_${ticker}`)
      if (raw) {
        this._cache[ticker] = JSON.parse(raw)
        return
      }
    } catch { /* fall through */ }
    // Try IndexedDB
    const idbData = await idbGet(ticker)
    if (idbData) {
      this._cache[ticker] = idbData
    }
  }

  // ── Persist one ticker ──────────────────────────────────────────────────

  async _persist(ticker) {
    const entries = this._cache[ticker] || []
    const json = JSON.stringify(entries)
    const key = `${LS_KEY}_${ticker}`

    // Check localStorage size budget
    if (!this._useIDB) {
      try {
        let used = 0
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          used += (localStorage.getItem(k) || '').length * 2 // rough byte estimate
        }
        if (used + json.length * 2 > LS_MAX_BYTES) {
          this._useIDB = true
        }
      } catch { this._useIDB = true }
    }

    if (this._useIDB) {
      await idbPut(ticker, entries)
      // Also clear from localStorage to free space
      try { localStorage.removeItem(key) } catch { /* ignore */ }
    } else {
      try {
        localStorage.setItem(key, json)
      } catch {
        // localStorage full – switch to IDB
        this._useIDB = true
        await idbPut(ticker, entries)
      }
    }
  }

  // ── Batch flush ─────────────────────────────────────────────────────────

  async _flush() {
    if (this._dirty.size === 0) return
    const tickers = [...this._dirty]
    this._dirty.clear()
    for (const ticker of tickers) {
      await this._persist(ticker)
    }
  }

  _scheduleFlush() {
    if (this._flushTimer) return
    this._flushTimer = setTimeout(async () => {
      this._flushTimer = null
      await this._flush()
    }, FLUSH_INTERVAL_MS)
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Record a price snapshot for today (one entry per day, last write wins). */
  async record(ticker, price) {
    await this._ensureMigrated()
    await this._load(ticker)
    const today = new Date().toISOString().slice(0, 10)
    if (!this._cache[ticker]) this._cache[ticker] = []
    const entries = this._cache[ticker]
    const last = entries[entries.length - 1]
    if (last && last.date === today) {
      last.price = price
    } else {
      entries.push({ date: today, price })
    }
    this._dirty.add(ticker)
    this._scheduleFlush()
  }

  /** Get the most recent recorded price for a ticker, or null. */
  async getPrice(ticker) {
    await this._ensureMigrated()
    await this._load(ticker)
    const entries = this._cache[ticker]
    if (!entries || entries.length === 0) return null
    return entries[entries.length - 1].price
  }

  /**
   * Get price entries for a ticker between two dates (inclusive).
   * @param {string} ticker
   * @param {string} startDate  ISO date string e.g. '2025-01-01'
   * @param {string} endDate    ISO date string e.g. '2025-12-31'
   */
  async getPriceRange(ticker, startDate, endDate) {
    await this._ensureMigrated()
    await this._load(ticker)
    const entries = this._cache[ticker] || []
    return entries.filter(e => (!startDate || e.date >= startDate) && (!endDate || e.date <= endDate))
  }

  /**
   * Get average price over the last `days` days.
   */
  async getAveragePrice(ticker, days) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const startDate = cutoff.toISOString().slice(0, 10)
    const entries = await this.getPriceRange(ticker, startDate, null)
    if (entries.length === 0) return null
    return entries.reduce((sum, e) => sum + e.price, 0) / entries.length
  }

  /**
   * Return all history for a ticker (compressed).
   */
  async getHistory(ticker) {
    await this._ensureMigrated()
    await this._load(ticker)
    return compressEntries(this._cache[ticker] || [])
  }

  /** Force-compress all loaded tickers and persist. */
  async compress() {
    for (const ticker of this._loaded) {
      if (this._cache[ticker]) {
        this._cache[ticker] = compressEntries(this._cache[ticker])
        this._dirty.add(ticker)
      }
    }
    await this._flush()
  }

  /** Export all data as a JSON-serialisable object (for backups). */
  async exportAll() {
    await this._ensureMigrated()
    // Load all tickers from IDB/LS
    let all = {}
    try {
      const idbAll = await idbGetAll()
      all = { ...idbAll }
    } catch { /* ignore */ }
    // Overlay with localStorage-based keys
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(`${LS_KEY}_`)) {
          const ticker = k.slice(LS_KEY.length + 1)
          try { all[ticker] = JSON.parse(localStorage.getItem(k)) } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
    // Merge with in-memory cache
    for (const [ticker, entries] of Object.entries(this._cache)) {
      all[ticker] = entries
    }
    return all
  }

  /**
   * Import data from a previously-exported object.
   * Merges with existing data (deduplicates by date).
   */
  async importAll(data) {
    if (!data || typeof data !== 'object') return
    for (const [ticker, entries] of Object.entries(data)) {
      if (!Array.isArray(entries)) continue
      await this._load(ticker)
      const existing = this._cache[ticker] || []
      const dateMap = new Map(existing.map(e => [e.date, e]))
      for (const e of entries) {
        if (e.date && e.price != null) dateMap.set(e.date, e)
      }
      this._cache[ticker] = [...dateMap.values()].sort((a, b) => a.date.localeCompare(b.date))
      this._dirty.add(ticker)
    }
    await this._flush()
  }
}

export const priceHistoryManager = new PriceHistoryManager()
