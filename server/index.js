import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as ibkr from './ibkr.js'
import * as db from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORTFOLIO_JSON = join(__dirname, '..', 'public', 'data', 'portfolio.json')

const app = express()
const PORT = process.env.PORT || 3001


app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

// ── Health / Auth ───────────────────────────────────────────────────────

app.get('/api/status', async (_req, res) => {
  res.json({
    authenticated: ibkr.isConnected(),
    connected: ibkr.isConnected(),
  })
})

app.post('/api/tickle', async (_req, res) => {
  res.json({ session: 'active', ssoExpires: 0 })
})

app.post('/api/reauthenticate', async (_req, res) => {
  try {
    ibkr.disconnect()
    await ibkr.connect()
    res.json({ authenticated: true })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

// ── Accounts ────────────────────────────────────────────────────────────

app.get('/api/accounts', async (_req, res, next) => {
  try {
    const data = await ibkr.getAccounts()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

app.get('/api/accounts/:accountId/summary', async (req, res, next) => {
  try {
    const data = await ibkr.getAccountSummary(req.params.accountId)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// ── Positions ───────────────────────────────────────────────────────────

app.get('/api/accounts/:accountId/positions', async (req, res, next) => {
  try {
    const data = await ibkr.getPositions()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// ── Orders ──────────────────────────────────────────────────────────────

app.get('/api/orders', async (_req, res, next) => {
  try {
    const data = await ibkr.getOpenOrders()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// ── Trades (filled orders) ──────────────────────────────────────────────

app.get('/api/trades', async (req, res, next) => {
  try {
    const data = await ibkr.getExecutions()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// ── Combined endpoint: builds the same shape the frontend already uses ──

// Helper: transform raw positions/executions into frontend format
function transformPortfolio(acctId, positions, executions, pnlByConId = {}) {
  const longPositions = []
  const shortPositions = []

  for (const pos of positions) {
    const pnlData = pnlByConId[pos.conId] || {}
    const entry = {
      ticker: pos.symbol,
      status: 'open',
      entryPrice: Math.abs(pos.avg_cost ?? pos.avgCost ?? 0),
      quantity: Math.abs(pos.position || 0),
      openDate: '',
      currency: pos.currency || 'USD',
      dailyPnL: pnlData.dailyPnL || 0,
      unrealizedPnL: pnlData.unrealizedPnL || 0,
      marketValue: pnlData.value || 0,
    }

    if (pos.position > 0) {
      longPositions.push(entry)
    } else if (pos.position < 0) {
      shortPositions.push(entry)
    }
  }

  const closedLongPositions = []
  const closedShortPositions = []

  for (const exec of executions) {
    const pnl = exec.realized_pnl ?? exec.realizedPnL
    const entryPrice = Math.abs(exec.price || 0)
    const exitPrice = Math.abs(exec.avg_price ?? exec.avgPrice ?? (exec.price || 0))
    const qty = Math.abs(exec.shares || 0)
    const totalCost = entryPrice * qty
    const profitPct = totalCost > 0 ? ((pnl || 0) / totalCost) * 100 : 0

    const closed = {
      ticker: exec.symbol,
      status: 'closed',
      entryPrice,
      quantity: qty,
      exitPrice,
      profitDollar: pnl || 0,
      profitPercent: profitPct,
      openDate: exec.time || '',
      closeDate: exec.time || '',
    }

    if (exec.side === 'SLD' && pnl) {
      closedLongPositions.push(closed)
    } else if (exec.side === 'BOT' && pnl) {
      closedShortPositions.push(closed)
    }
  }

  return { accountId: acctId, longPositions, shortPositions, closedLongPositions, closedShortPositions }
}

app.get('/api/portfolio', async (_req, res, next) => {
  let result = null

  // Try live data from IB Gateway
  if (ibkr.isConnected()) {
    try {
      const accountsData = await ibkr.getAccounts()
      const acctId = accountsData.accounts?.[0]
      if (!acctId) {
        return res.status(400).json({ error: 'No IBKR account found.' })
      }

      const [positions, executions] = await Promise.all([
        ibkr.getPositions(),
        ibkr.getExecutions(),
      ])

      // Fetch daily PnL for each position (in parallel, with graceful failure)
      const pnlByConId = {}
      const pnlPromises = positions.map(async (pos) => {
        try {
          const pnl = await ibkr.getPositionPnL(acctId, pos.conId)
          pnlByConId[pos.conId] = pnl
        } catch {
          // PnL not available for this position — skip
        }
      })
      await Promise.all(pnlPromises)

      // Save snapshot + live executions to DB
      try {
        db.saveSnapshot(acctId, positions, executions)
        db.saveLiveExecutions(executions, acctId)
        console.log(`Saved portfolio snapshot for ${acctId}`)
      } catch (dbErr) {
        console.error('Failed to save snapshot:', dbErr.message)
      }

      result = transformPortfolio(acctId, positions, executions, pnlByConId)
    } catch (err) {
      console.error('Live fetch failed, falling back to cached data:', err.message)
    }
  }

  // Fall back to cached snapshot
  if (!result) {
    const cached = db.getLatest()
    if (cached) {
      console.log(`Serving cached data from ${cached.fetchedAt}`)
      result = transformPortfolio(cached.accountId, cached.positions, cached.executions)
      result.cached = true
      result.cachedAt = cached.fetchedAt
    }
  }

  if (!result) {
    return res.status(503).json({ error: 'IB Gateway is offline and no cached data available.' })
  }

  res.json(result)
})

// ── Export: save live portfolio to static JSON for GitHub Pages ─────────

app.post('/api/export', async (_req, res) => {
  let result = null

  // Try live data first
  if (ibkr.isConnected()) {
    try {
      const accountsData = await ibkr.getAccounts()
      const acctId = accountsData.accounts?.[0]
      if (!acctId) return res.status(400).json({ error: 'No IBKR account found.' })

      const [positions, executions] = await Promise.all([
        ibkr.getPositions(),
        ibkr.getExecutions(),
      ])

      const pnlByConId = {}
      await Promise.all(positions.map(async (pos) => {
        try {
          pnlByConId[pos.conId] = await ibkr.getPositionPnL(acctId, pos.conId)
        } catch { /* skip */ }
      }))

      result = transformPortfolio(acctId, positions, executions, pnlByConId)
    } catch (err) {
      console.error('Live fetch failed for export:', err.message)
    }
  }

  // Fall back to cached data
  if (!result) {
    const cached = db.getLatest()
    if (cached) {
      result = transformPortfolio(cached.accountId, cached.positions, cached.executions)
    }
  }

  if (!result) {
    return res.status(503).json({ error: 'No data available to export.' })
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    longPositions: result.longPositions,
    shortPositions: result.shortPositions,
    closedLongPositions: result.closedLongPositions,
    closedShortPositions: result.closedShortPositions,
  }

  try {
    writeFileSync(PORTFOLIO_JSON, JSON.stringify(payload, null, 2) + '\n')
    console.log(`Exported portfolio to ${PORTFOLIO_JSON}`)
    res.json({ ok: true, updatedAt: payload.updatedAt, file: PORTFOLIO_JSON })
  } catch (err) {
    res.status(500).json({ error: `Failed to write file: ${err.message}` })
  }
})

// ── History endpoint ────────────────────────────────────────────────────

app.get('/api/history', async (req, res) => {
  const limit = Number(req.query.limit) || 100
  const snapshots = db.getSnapshotHistory(limit)
  res.json(snapshots)
})

app.get('/api/history/:snapshotId', async (req, res) => {
  const snapshot = db.getSnapshotById(Number(req.params.snapshotId))
  if (!snapshot) {
    return res.status(404).json({ error: 'Snapshot not found' })
  }
  res.json(transformPortfolio(snapshot.accountId, snapshot.positions, snapshot.executions))
})

// ── Error handler ───────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error('[IBKR API Error]', err.message)
  const status = err.status || 502
  res.status(status).json({
    error: err.message,
    hint: status === 503
      ? `Make sure the IB Gateway is running and the API is enabled on port ${process.env.TWS_PORT || 4001}`
      : undefined,
  })
})

// ── Start server & connect to IB Gateway ────────────────────────────────

async function start() {
  app.listen(PORT, () => {
    console.log(`Trading server running on http://localhost:${PORT}`)
  })

  try {
    await ibkr.connect()
    console.log('Successfully connected to IB Gateway TWS API')
  } catch (err) {
    console.error(`Failed to connect to IB Gateway: ${err.message}`)
    console.error(`Make sure IB Gateway is running with API enabled on port ${process.env.TWS_PORT || 4001}`)
  }
}

start()
