import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import * as ibkr from './ibkr.js'
import * as db from './db.js'

const app = express()
const PORT = process.env.PORT || 3001
const upload = multer({ storage: multer.memoryStorage() })

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

// Helper: transform trades from DB into closed positions format
function tradesToClosedPositions(trades) {
  const closedLong = []
  const closedShort = []

  for (const t of trades) {
    const totalCost = t.price * t.quantity
    const profitPct = totalCost > 0 ? (t.realized_pnl / totalCost) * 100 : 0

    const closed = {
      ticker: t.symbol,
      status: 'closed',
      entryPrice: t.price,
      quantity: t.quantity,
      exitPrice: t.price,
      profitDollar: t.realized_pnl || 0,
      profitPercent: profitPct,
      openDate: t.trade_date,
      closeDate: t.trade_date,
    }

    // SLD = sold long position, BOT = bought back short position
    if (t.side === 'SLD' || t.side === 'S' || t.side === 'SELL') {
      closedLong.push(closed)
    } else if (t.side === 'BOT' || t.side === 'B' || t.side === 'BUY') {
      closedShort.push(closed)
    }
  }

  return { closedLong, closedShort }
}

// Helper: transform raw positions/executions into frontend format
function transformPortfolio(acctId, positions, executions) {
  const longPositions = []
  const shortPositions = []

  for (const pos of positions) {
    const entry = {
      ticker: pos.symbol,
      status: 'open',
      entryPrice: Math.abs(pos.avg_cost ?? pos.avgCost ?? 0),
      quantity: Math.abs(pos.position || 0),
      openDate: '',
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

      // Save snapshot + live executions to DB
      try {
        db.saveSnapshot(acctId, positions, executions)
        db.saveLiveExecutions(executions, acctId)
        console.log(`Saved portfolio snapshot for ${acctId}`)
      } catch (dbErr) {
        console.error('Failed to save snapshot:', dbErr.message)
      }

      result = transformPortfolio(acctId, positions, executions)
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

  // Merge historical closed trades from the trades table
  const historicalTrades = db.getTrades({ year: null, limit: 10000 })
  if (historicalTrades.length > 0) {
    const { closedLong, closedShort } = tradesToClosedPositions(historicalTrades)

    // Deduplicate: remove trades already present from live executions (by matching symbol + date + side)
    const liveKeys = new Set([
      ...result.closedLongPositions.map(p => `${p.ticker}|${p.closeDate}|SLD`),
      ...result.closedShortPositions.map(p => `${p.ticker}|${p.closeDate}|BOT`),
    ])

    for (const t of closedLong) {
      const key = `${t.ticker}|${t.closeDate}|SLD`
      if (!liveKeys.has(key)) {
        result.closedLongPositions.push(t)
        liveKeys.add(key)
      }
    }
    for (const t of closedShort) {
      const key = `${t.ticker}|${t.closeDate}|BOT`
      if (!liveKeys.has(key)) {
        result.closedShortPositions.push(t)
        liveKeys.add(key)
      }
    }
  }

  res.json(result)
})

// ── CSV Import endpoint ─────────────────────────────────────────────────

// Parse a CSV line respecting quoted fields (handles commas inside quotes)
function splitCSVLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  // Find the Transaction History header line specifically
  // IB CSVs have multiple sections (Statement, Summary, Transaction History) each with ",Header,"
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Transaction History,Header,') || lines[i].startsWith('Trades,Header,')) {
      headerIdx = i
      break
    }
  }
  // Fallback: if no IB section header found, look for any line with ",Header," or use first line
  if (headerIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(',Header,') || lines[i].includes(',header,')) {
        headerIdx = i
        break
      }
    }
  }
  if (headerIdx === -1) headerIdx = 0

  const rawHeaders = splitCSVLine(lines[headerIdx]).map(h => h.replace(/"/g, ''))

  // Check if this is IB Transaction History format (has "Transaction History,Header,..." prefix)
  const isIBTransactionHistory = rawHeaders[0] === 'Transaction History' && rawHeaders[1] === 'Header'

  // Get actual field headers (skip the prefix columns for IB format)
  const fieldStart = isIBTransactionHistory ? 2 : 0
  const headers = rawHeaders.slice(fieldStart)

  console.log(`CSV Parser: ${isIBTransactionHistory ? 'IB Transaction History' : 'Generic CSV'} format detected`)
  console.log(`CSV Parser: Headers found: ${headers.join(', ')}`)

  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const allValues = splitCSVLine(line).map(v => v.replace(/"/g, ''))

    // For IB format, skip rows that aren't "Data" rows
    if (isIBTransactionHistory) {
      if (allValues[1] !== 'Data') continue
    }

    const values = allValues.slice(fieldStart)
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || ''
    }
    rows.push(row)
  }

  console.log(`CSV Parser: Parsed ${rows.length} data rows`)
  if (rows.length > 0) {
    console.log(`CSV Parser: Sample row:`, JSON.stringify(rows[0]))
  }

  return rows
}

function mapTradeRow(row) {
  // Flexible column name matching
  const get = (keys) => {
    for (const k of keys) {
      const kNorm = k.toLowerCase().replace(/[^a-z]/g, '')
      const match = Object.keys(row).find(h => h.toLowerCase().replace(/[^a-z]/g, '') === kNorm)
      if (match && row[match] !== '') return row[match]
    }
    return ''
  }

  const symbol = get(['Symbol', 'symbol', 'UnderlyingSymbol'])
  const dateTime = get(['Date', 'DateTime', 'TradeDate', 'Date/Time', 'Trade Date'])
  const transType = get(['Transaction Type', 'TransactionType', 'Buy/Sell', 'Side', 'BuySell', 'Action'])
  const qty = get(['Quantity', 'quantity', 'Shares', 'Qty'])
  const price = get(['Price', 'TradePrice', 'Trade Price'])
  const commission = get(['Commission', 'IBCommission', 'Comm'])
  const grossAmount = get(['Gross Amount', 'GrossAmount', 'Gross'])
  const netAmount = get(['Net Amount', 'NetAmount', 'Net'])
  const pnl = get(['RealizedPnL', 'Realized P/L', 'Realized P&L', 'FifoPnlRealized', 'MTM P/L'])
  const currency = get(['Price Currency', 'CurrencyPrimary', 'Currency'])
  const account = get(['Account', 'AccountId', 'account_id'])
  const description = get(['Description', 'description'])
  const execId = get(['ExecID', 'exec_id', 'ExecutionID', 'IBExecID'])
  const orderId = get(['OrderID', 'order_id', 'IBOrderID'])

  if (!symbol || !dateTime || symbol === '-') return null

  // Skip non-trade rows (dividends, interest, forex, adjustments)
  const skipTypes = ['adjustment', 'debit interest', 'credit interest', 'dividend', 'withholding tax', 'forex trade component']
  if (transType && skipTypes.includes(transType.toLowerCase())) return null

  // Normalize date to YYYY-MM-DD
  let tradeDate = dateTime
  if (dateTime.includes(',')) {
    tradeDate = new Date(dateTime).toISOString().slice(0, 10)
  } else if (dateTime.includes('/')) {
    const parts = dateTime.split('/')
    if (parts[2]?.length === 4) {
      tradeDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
    }
  } else if (dateTime.length === 8 && !dateTime.includes('-')) {
    tradeDate = `${dateTime.slice(0, 4)}-${dateTime.slice(4, 6)}-${dateTime.slice(6, 8)}`
  } else if (dateTime.length > 10) {
    tradeDate = dateTime.slice(0, 10)
  }

  // Normalize side from Transaction Type
  let normalizedSide = transType.toUpperCase()
  if (normalizedSide === 'SELL' || normalizedSide === 'S') normalizedSide = 'SLD'
  if (normalizedSide === 'BUY' || normalizedSide === 'B') normalizedSide = 'BOT'

  // For IB Transaction History: use Gross Amount as a proxy for P&L if no explicit P&L column
  // Gross Amount is positive for sells, negative for buys
  const realizedPnl = parseFloat(pnl) || 0

  const parsedQty = Math.abs(parseFloat(qty) || 0)
  const parsedPrice = Math.abs(parseFloat(price) || 0)

  return {
    account_id: account || null,
    symbol,
    trade_date: tradeDate,
    side: normalizedSide,
    quantity: parsedQty,
    price: parsedPrice,
    commission: Math.abs(parseFloat(commission) || 0),
    realized_pnl: realizedPnl,
    currency: currency || 'USD',
    sec_type: 'STK',
    exchange: null,
    order_id: orderId || null,
    exec_id: execId || `import-${symbol}-${tradeDate}-${normalizedSide}-${parsedQty}-${parsedPrice}`,
  }
}

app.post('/api/import', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Send a CSV file as "file" field.' })
    }

    const text = req.file.buffer.toString('utf-8')
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or has no data rows.' })
    }

    const trades = rows.map((row, idx) => {
      const result = mapTradeRow(row)
      if (!result && idx < 3) {
        console.log(`CSV Parser: Row ${idx} could not be mapped:`, JSON.stringify(row))
      }
      return result
    }).filter(Boolean)

    console.log(`CSV Parser: ${trades.length} of ${rows.length} rows mapped to trades`)

    if (trades.length === 0) {
      return res.status(400).json({
        error: 'Could not parse any trades. Make sure the CSV has Symbol and Date columns.',
        sampleHeaders: Object.keys(rows[0]),
        sampleRow: rows[0],
      })
    }

    const imported = db.importTrades(trades, 'ib-transaction-history')

    // Auto-calculate P&L using FIFO matching for trades missing it
    const pnlUpdated = db.calculatePnL()

    res.json({
      message: `Imported ${imported} new trades (${trades.length - imported} duplicates skipped). Calculated P&L for ${pnlUpdated} trades.`,
      imported,
      total: trades.length,
      skipped: trades.length - imported,
      pnlCalculated: pnlUpdated,
    })
  } catch (err) {
    console.error('Import error:', err)
    res.status(500).json({ error: err.message })
  }
})

// ── Trades from DB ──────────────────────────────────────────────────────

app.get('/api/db/trades', (req, res) => {
  const year = req.query.year || null
  const symbol = req.query.symbol || null
  const limit = Number(req.query.limit) || 1000
  const trades = db.getTrades({ year, symbol, limit })
  res.json(trades)
})

app.post('/api/db/recalculate-pnl', (req, res) => {
  try {
    const updated = db.calculatePnL()
    res.json({ message: `Recalculated P&L for ${updated} trades`, updated })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/db/stats', (req, res) => {
  const year = req.query.year || null
  const stats = db.getTradeStats(year)
  res.json(stats)
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
