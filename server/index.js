import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import * as ibkr from './ibkr.js'

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
  // TWS socket connections don't need keepalive tickle, but keep the endpoint
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

app.get('/api/portfolio', async (_req, res, next) => {
  try {
    // 1. Get accounts
    const accountsData = await ibkr.getAccounts()
    const acctId = accountsData.accounts?.[0]
    if (!acctId) {
      return res.status(400).json({ error: 'No IBKR account found. Make sure you are authenticated in the IB Gateway.' })
    }

    // 2. Fetch positions + executions in parallel
    const [positions, executions] = await Promise.all([
      ibkr.getPositions(),
      ibkr.getExecutions(),
    ])

    // 3. Transform positions into the app's format
    const longPositions = []
    const shortPositions = []

    for (const pos of positions) {
      const entry = {
        ticker: pos.symbol,
        status: 'open',
        entryPrice: Math.abs(pos.avgCost || 0),
        quantity: Math.abs(pos.position || 0),
        openDate: '',
      }

      if (pos.position > 0) {
        longPositions.push(entry)
      } else if (pos.position < 0) {
        shortPositions.push(entry)
      }
    }

    // 4. Transform executions into closed positions
    const closedLongPositions = []
    const closedShortPositions = []

    for (const exec of executions) {
      const closed = {
        ticker: exec.symbol,
        status: 'closed',
        entryPrice: Math.abs(exec.price || 0),
        quantity: Math.abs(exec.shares || 0),
        exitPrice: Math.abs(exec.avgPrice || exec.price || 0),
        profitDollar: exec.realizedPnL || 0,
        profitPercent: 0,
        openDate: exec.time || '',
        closeDate: exec.time || '',
      }

      // SLD = sold (closing a long), BOT = bought (closing a short)
      if (exec.side === 'SLD' && exec.realizedPnL) {
        closedLongPositions.push(closed)
      } else if (exec.side === 'BOT' && exec.realizedPnL) {
        closedShortPositions.push(closed)
      }
    }

    res.json({
      accountId: acctId,
      longPositions,
      shortPositions,
      closedLongPositions,
      closedShortPositions,
    })
  } catch (err) {
    next(err)
  }
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
