/**
 * SQLite persistence layer for portfolio data.
 *
 * Stores positions and executions with timestamps so the app can:
 * - Show last-known data when the IB Gateway is offline
 * - Track portfolio history over time
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

  CREATE INDEX IF NOT EXISTS idx_positions_snapshot ON positions(snapshot_id);
  CREATE INDEX IF NOT EXISTS idx_executions_snapshot ON executions(snapshot_id);
  CREATE INDEX IF NOT EXISTS idx_snapshots_fetched ON snapshots(fetched_at);
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

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Save a portfolio snapshot (positions + executions) to the database.
 */
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

/**
 * Get the most recent portfolio snapshot from the database.
 * Returns null if no data has been saved yet.
 */
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

/**
 * Get all snapshots (metadata only) for history view.
 */
export function getSnapshotHistory(limit = 100) {
  return db.prepare(
    'SELECT id, account_id, fetched_at FROM snapshots ORDER BY fetched_at DESC LIMIT ?'
  ).all(limit)
}

/**
 * Get a specific snapshot by ID.
 */
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

export default db
