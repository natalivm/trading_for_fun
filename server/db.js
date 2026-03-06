/**
 * SQLite persistence layer for portfolio data.
 *
 * Stores:
 * - trades: Permanent historical trade records (imported from Flex Query + daily live)
 * - snapshots/positions/executions: Point-in-time portfolio snapshots
 */

import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'portfolio.db')

const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')

// ── Schema ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    sec_type TEXT,
    exchange TEXT,
    currency TEXT,
    con_id INTEGER,
    position REAL NOT NULL,
    avg_cost REAL NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('long', 'short'))
  );

  CREATE TABLE IF NOT EXISTS executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    sec_type TEXT,
    currency TEXT,
    con_id INTEGER,
    exec_id TEXT,
    time TEXT,
    side TEXT,
    shares REAL,
    price REAL,
    avg_price REAL,
    account TEXT,
    realized_pnl REAL,
    order_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id TEXT,
    symbol TEXT NOT NULL,
    trade_date TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    gross_amount REAL DEFAULT 0,
    commission REAL DEFAULT 0,
    realized_pnl REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    sec_type TEXT DEFAULT 'STK',
    exchange TEXT,
    order_id TEXT,
    exec_id TEXT UNIQUE,
    source TEXT DEFAULT 'import',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_positions_snapshot ON positions(snapshot_id);
  CREATE INDEX IF NOT EXISTS idx_executions_snapshot ON executions(snapshot_id);
  CREATE INDEX IF NOT EXISTS idx_snapshots_fetched ON snapshots(fetched_at);
  CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(trade_date);
  CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
  CREATE INDEX IF NOT EXISTS idx_trades_exec_id ON trades(exec_id);
`)

// ── Migrations ──────────────────────────────────────────────────────────
// Add gross_amount column if missing (for existing DBs)
try {
  db.exec('ALTER TABLE trades ADD COLUMN gross_amount REAL DEFAULT 0')
} catch { /* column already exists */ }

// ── Prepared statements ─────────────────────────────────────────────────

const insertSnapshot = db.prepare(
  'INSERT INTO snapshots (account_id) VALUES (?)'
)

const insertPosition = db.prepare(`
  INSERT INTO positions (snapshot_id, symbol, sec_type, exchange, currency, con_id, position, avg_cost, side)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const insertExecution = db.prepare(`
  INSERT INTO executions (snapshot_id, symbol, sec_type, currency, con_id, exec_id, time, side, shares, price, avg_price, account, realized_pnl, order_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const getLatestSnapshot = db.prepare(
  'SELECT * FROM snapshots ORDER BY fetched_at DESC LIMIT 1'
)

const getPositionsBySnapshot = db.prepare(
  'SELECT * FROM positions WHERE snapshot_id = ?'
)

const getExecutionsBySnapshot = db.prepare(
  'SELECT * FROM executions WHERE snapshot_id = ?'
)

const insertTrade = db.prepare(`
  INSERT OR IGNORE INTO trades (account_id, symbol, trade_date, side, quantity, price, gross_amount, commission, realized_pnl, currency, sec_type, exchange, order_id, exec_id, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

// ── Snapshot API ────────────────────────────────────────────────────────

export function saveSnapshot(accountId, positions, executions) {
  const save = db.transaction(() => {
    const { lastInsertRowid: snapshotId } = insertSnapshot.run(accountId)

    for (const pos of positions) {
      const side = pos.position > 0 ? 'long' : 'short'
      insertPosition.run(
        snapshotId, pos.symbol, pos.secType, pos.exchange,
        pos.currency, pos.conId, pos.position, pos.avgCost, side
      )
    }

    for (const exec of executions) {
      insertExecution.run(
        snapshotId, exec.symbol, exec.secType, exec.currency,
        exec.conId, exec.execId, exec.time, exec.side,
        exec.shares, exec.price, exec.avgPrice, exec.account,
        exec.realizedPnL, exec.orderId
      )
    }

    return snapshotId
  })

  return save()
}

export function getLatest() {
  const snapshot = getLatestSnapshot.get()
  if (!snapshot) return null

  const positions = getPositionsBySnapshot.all(snapshot.id)
  const executions = getExecutionsBySnapshot.all(snapshot.id)

  return {
    accountId: snapshot.account_id,
    fetchedAt: snapshot.fetched_at,
    positions,
    executions,
  }
}

export function getSnapshotHistory(limit = 100) {
  return db.prepare(
    'SELECT id, account_id, fetched_at FROM snapshots ORDER BY fetched_at DESC LIMIT ?'
  ).all(limit)
}

export function getSnapshotById(snapshotId) {
  const snapshot = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(snapshotId)
  if (!snapshot) return null

  const positions = getPositionsBySnapshot.all(snapshot.id)
  const executions = getExecutionsBySnapshot.all(snapshot.id)

  return {
    accountId: snapshot.account_id,
    fetchedAt: snapshot.fetched_at,
    positions,
    executions,
  }
}

// ── Trades API (permanent historical records) ───────────────────────────

/**
 * Import trades from parsed CSV rows.
 * Each row should have: symbol, trade_date, side, quantity, price, commission, realized_pnl, currency, etc.
 */
export function importTrades(trades, source = 'import') {
  const doImport = db.transaction(() => {
    let imported = 0
    for (const t of trades) {
      const result = insertTrade.run(
        t.account_id || null,
        t.symbol,
        t.trade_date,
        t.side,
        Math.abs(t.quantity || 0),
        Math.abs(t.price || 0),
        t.gross_amount || 0,
        t.commission || 0,
        t.realized_pnl || 0,
        t.currency || 'USD',
        t.sec_type || 'STK',
        t.exchange || null,
        t.order_id || null,
        t.exec_id || null,
        source,
      )
      if (result.changes > 0) imported++
    }
    return imported
  })

  return doImport()
}

/**
 * Save today's live executions as permanent trade records.
 */
export function saveLiveExecutions(executions, accountId) {
  const trades = executions.map((exec) => ({
    account_id: accountId || exec.account,
    symbol: exec.symbol,
    trade_date: exec.time || new Date().toISOString().slice(0, 10),
    side: exec.side,
    quantity: exec.shares,
    price: exec.price,
    gross_amount: 0,
    commission: 0,
    realized_pnl: exec.realizedPnL || 0,
    currency: exec.currency || 'USD',
    sec_type: exec.secType || 'STK',
    exchange: null,
    order_id: exec.orderId ? String(exec.orderId) : null,
    exec_id: exec.execId || null,
  }))

  return importTrades(trades, 'live')
}

/**
 * Get all trades, optionally filtered by year.
 */
export function getTrades({ year, symbol, limit = 1000 } = {}) {
  let sql = 'SELECT * FROM trades WHERE 1=1'
  const params = []

  if (year) {
    sql += ' AND trade_date LIKE ?'
    params.push(`${year}%`)
  }
  if (symbol) {
    sql += ' AND symbol = ?'
    params.push(symbol)
  }

  sql += ' ORDER BY trade_date DESC LIMIT ?'
  params.push(limit)

  return db.prepare(sql).all(...params)
}

/**
 * Get trade summary stats.
 */
export function getTradeStats(year) {
  let sql = `
    SELECT
      COUNT(*) as total_trades,
      SUM(CASE WHEN realized_pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
      SUM(CASE WHEN realized_pnl < 0 THEN 1 ELSE 0 END) as losing_trades,
      SUM(realized_pnl) as total_pnl,
      SUM(commission) as total_commission
    FROM trades WHERE 1=1
  `
  const params = []
  if (year) {
    sql += ' AND trade_date LIKE ?'
    params.push(`${year}%`)
  }

  return db.prepare(sql).get(...params)
}

/**
 * Calculate realized P&L using FIFO matching of buys and sells per symbol.
 * Updates trades in the DB that have realized_pnl = 0.
 */
export function calculatePnL() {
  // Reset all imported trade P&L to 0 first, then recalculate from scratch
  // This avoids stale P&L values from partial previous runs
  db.prepare("UPDATE trades SET realized_pnl = 0 WHERE source != 'live'").run()

  // Get all trades ordered by date for FIFO matching
  const allTrades = db.prepare(
    'SELECT * FROM trades ORDER BY trade_date ASC, id ASC'
  ).all()

  // Group by symbol
  const bySymbol = {}
  for (const t of allTrades) {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = []
    bySymbol[t.symbol].push(t)
  }

  const updatePnl = db.prepare('UPDATE trades SET realized_pnl = ? WHERE id = ?')

  const calc = db.transaction(() => {
    let updated = 0

    for (const [symbol, trades] of Object.entries(bySymbol)) {
      // FIFO queues: { qty, price } entries
      const longQueue = []  // buys waiting to be sold
      const shortQueue = [] // shorts waiting to be covered

      for (const trade of trades) {
        const tradePrice = trade.price

        if (trade.side === 'BOT' || trade.side === 'BUY') {
          if (shortQueue.length > 0) {
            // Covering a short position
            let remaining = trade.quantity
            let pnl = 0

            while (remaining > 0 && shortQueue.length > 0) {
              const short = shortQueue[0]
              const matched = Math.min(remaining, short.qty)
              // Short P&L: sold high, bought back low = profit
              pnl += matched * (short.price - tradePrice)
              remaining -= matched
              short.qty -= matched
              if (short.qty <= 0) shortQueue.shift()
            }

            if (pnl !== 0) {
              pnl -= Math.abs(trade.commission)
              updatePnl.run(pnl, trade.id)
              updated++
            }

            // Leftover becomes a new long
            if (remaining > 0) {
              longQueue.push({ qty: remaining, price: tradePrice })
            }
          } else {
            // Opening a long
            longQueue.push({ qty: trade.quantity, price: tradePrice })
          }
        } else if (trade.side === 'SLD' || trade.side === 'SELL') {
          if (longQueue.length > 0) {
            // Closing a long position
            let remaining = trade.quantity
            let pnl = 0

            while (remaining > 0 && longQueue.length > 0) {
              const long = longQueue[0]
              const matched = Math.min(remaining, long.qty)
              // Long P&L: sold high minus bought low = profit
              pnl += matched * (tradePrice - long.price)
              remaining -= matched
              long.qty -= matched
              if (long.qty <= 0) longQueue.shift()
            }

            if (pnl !== 0) {
              pnl -= Math.abs(trade.commission)
              updatePnl.run(pnl, trade.id)
              updated++
            }

            // Leftover becomes a new short
            if (remaining > 0) {
              shortQueue.push({ qty: remaining, price: tradePrice })
            }
          } else {
            // Opening a short
            shortQueue.push({ qty: trade.quantity, price: tradePrice })
          }
        }
      }
    }

    return updated
  })

  return calc()
}

export default db
