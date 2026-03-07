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
  INSERT OR IGNORE INTO trades (account_id, symbol, trade_date, side, quantity, price, commission, realized_pnl, currency, sec_type, exchange, order_id, exec_id, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

// ── Trades API ───────────────────────────────────────────────────────────

/**
 * Save today's live executions as permanent trade records.
 */
export function saveLiveExecutions(executions, accountId) {
  const doSave = db.transaction(() => {
    let saved = 0
    for (const exec of executions) {
      const result = insertTrade.run(
        accountId || exec.account || null,
        exec.symbol,
        exec.time || new Date().toISOString().slice(0, 10),
        exec.side,
        Math.abs(exec.shares || 0),
        Math.abs(exec.price || 0),
        0,
        exec.realizedPnL || 0,
        exec.currency || 'USD',
        exec.secType || 'STK',
        null,
        exec.orderId ? String(exec.orderId) : null,
        exec.execId || null,
        'live',
      )
      if (result.changes > 0) saved++
    }
    return saved
  })

  return doSave()
}

export default db

// ── Ticker history (for sparkline charts) ────────────────────────────────

export function getTickerHistory(ticker, limit = 60) {
  return db.prepare(`
    SELECT
      s.fetched_at,
      p.position,
      p.avg_cost,
      p.side
    FROM positions p
    JOIN snapshots s ON s.id = p.snapshot_id
    WHERE p.symbol = ?
    ORDER BY s.fetched_at DESC
    LIMIT ?
  `).all(ticker, limit)
}
