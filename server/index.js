import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import * as ibkr from './ibkr.js'

// IB Gateway uses a self-signed cert — allow it in development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }))
app.use(express.json())

// ── Health / Auth ───────────────────────────────────────────────────────

app.get('/api/status', async (_req, res, next) => {
  try {
    const status = await ibkr.getAuthStatus()
    res.json(status)
  } catch (err) {
    next(err)
  }
})

app.post('/api/tickle', async (_req, res, next) => {
  try {
    const data = await ibkr.tickle()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

app.post('/api/reauthenticate', async (_req, res, next) => {
  try {
    const data = await ibkr.reauthenticate()
    res.json(data)
  } catch (err) {
    next(err)
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
    const page = Number(req.query.page) || 0
    const data = await ibkr.getPositions(req.params.accountId, page)
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// ── Orders ──────────────────────────────────────────────────────────────

app.get('/api/orders', async (_req, res, next) => {
  try {
    const data = await ibkr.getLiveOrders()
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// ── Trades (filled orders) ──────────────────────────────────────────────

app.get('/api/trades', async (req, res, next) => {
  try {
    const days = Number(req.query.days) || 7
    const data = await ibkr.getTrades(days)
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
    const accountId = accountsData.accounts?.[0] || accountsData[0]?.accountId
    if (!accountId) {
      return res.status(400).json({ error: 'No IBKR account found. Make sure you are authenticated in the IB Gateway.' })
    }

    // 2. Fetch positions + trades in parallel
    const [positions, tradesData] = await Promise.all([
      ibkr.getPositions(accountId),
      ibkr.getTrades(30),
    ])

    // 3. Transform positions into the app's format
    const longPositions = []
    const shortPositions = []

    for (const pos of positions) {
      const entry = {
        ticker: pos.contractDesc || pos.ticker || pos.symbol || '',
        status: 'open',
        entryPrice: Math.abs(pos.avgCost || pos.avgPrice || 0),
        quantity: Math.abs(pos.position || pos.pos || 0),
        openDate: '', // IBKR positions don't always include open date
      }

      if ((pos.position || pos.pos || 0) > 0) {
        longPositions.push(entry)
      } else if ((pos.position || pos.pos || 0) < 0) {
        shortPositions.push(entry)
      }
    }

    // 4. Transform trades into closed positions
    const closedLongPositions = []
    const closedShortPositions = []

    const trades = Array.isArray(tradesData) ? tradesData : []
    for (const trade of trades) {
      // Only include closed/filled trades
      if (!trade.realized_pnl && trade.realized_pnl !== 0) continue

      const closed = {
        ticker: trade.contractDesc || trade.symbol || '',
        status: 'closed',
        entryPrice: Math.abs(trade.price || 0),
        quantity: Math.abs(trade.size || trade.quantity || 0),
        exitPrice: Math.abs(trade.price || 0),
        profitDollar: trade.realized_pnl || 0,
        profitPercent: 0,
        openDate: trade.trade_time || trade.tradeTime || '',
        closeDate: trade.trade_time || trade.tradeTime || '',
      }

      if ((trade.side === 'SLD' || trade.side === 'S') && trade.realized_pnl) {
        closedLongPositions.push(closed)
      } else if ((trade.side === 'BOT' || trade.side === 'B') && trade.realized_pnl) {
        closedShortPositions.push(closed)
      }
    }

    res.json({
      accountId,
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
    hint: status === 502
      ? 'Make sure the IB Client Portal Gateway is running on https://localhost:5000'
      : undefined,
  })
})

app.listen(PORT, () => {
  console.log(`Trading server running on http://localhost:${PORT}`)
  console.log(`Proxying IBKR requests to ${process.env.IBKR_GATEWAY_URL || 'https://localhost:5000'}`)
})
