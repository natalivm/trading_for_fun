/**
 * IBKR TWS API service layer using @stoqey/ib.
 *
 * Connects to IB Gateway via the TWS socket protocol (default port 4001).
 * Replaces the previous Client Portal REST approach.
 */

import { IBApi, EventName, SecType } from '@stoqey/ib'

const TWS_HOST = process.env.TWS_HOST || '127.0.0.1'
const TWS_PORT = Number(process.env.TWS_PORT) || 4001
const CLIENT_ID = Number(process.env.TWS_CLIENT_ID) || 1

let ib = null
let connected = false
let accountId = null

// ── Connection ──────────────────────────────────────────────────────────

export function connect() {
  return new Promise((resolve, reject) => {
    if (ib && connected) return resolve()

    ib = new IBApi({ host: TWS_HOST, port: TWS_PORT, clientId: CLIENT_ID })

    const timeout = setTimeout(() => {
      reject(new Error(`Connection timeout — could not reach IB Gateway at ${TWS_HOST}:${TWS_PORT}`))
    }, 10_000)

    ib.on(EventName.connected, () => {
      connected = true
      clearTimeout(timeout)
      console.log(`Connected to IB Gateway at ${TWS_HOST}:${TWS_PORT}`)
      resolve()
    })

    ib.on(EventName.disconnected, () => {
      connected = false
      accountId = null
      console.log('Disconnected from IB Gateway')
    })

    ib.on(EventName.error, (err, code, reqId) => {
      // Non-fatal informational messages from IB (code 2104, 2106, 2158, etc.)
      if (code >= 2100 && code < 2200) {
        console.log(`[IB Info ${code}] ${err}`)
        return
      }
      console.error(`[IB Error ${code}] reqId=${reqId}: ${err}`)
    })

    ib.connect()
  })
}

export function disconnect() {
  if (ib) {
    ib.disconnect()
    ib = null
    connected = false
    accountId = null
  }
}

export function isConnected() {
  return connected
}

function ensureConnected() {
  if (!ib || !connected) {
    throw Object.assign(new Error('Not connected to IB Gateway'), { status: 503 })
  }
}

// ── Helper: collect event-driven results with a timeout ─────────────────

function collectWithTimeout(ms = 8000) {
  let timer
  const promise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('IB Gateway request timed out')), ms)
  })
  return { timer, promise }
}

// ── Accounts ────────────────────────────────────────────────────────────

export function getAccounts() {
  ensureConnected()
  return new Promise((resolve, reject) => {
    const { timer, promise: timeout } = collectWithTimeout()

    const handler = (accountsList) => {
      clearTimeout(timer)
      // managedAccounts event passes a comma-separated string, not an array
      const accounts = typeof accountsList === 'string'
        ? accountsList.split(',').map(a => a.trim()).filter(Boolean)
        : Array.isArray(accountsList) ? accountsList : []
      if (accounts.length > 0) {
        accountId = accounts[0]
      }
      resolve({ accounts })
    }

    ib.once(EventName.managedAccounts, handler)
    ib.reqManagedAccts()

    timeout.catch((err) => {
      ib.removeListener(EventName.managedAccounts, handler)
      reject(err)
    })
  })
}

// ── Account Summary ─────────────────────────────────────────────────────

export function getAccountSummary(acctId) {
  ensureConnected()
  const reqId = Math.floor(Math.random() * 100000) + 1000

  return new Promise((resolve, reject) => {
    const { timer, promise: timeout } = collectWithTimeout()
    const summary = {}

    const dataHandler = (id, account, tag, value, currency) => {
      if (id !== reqId) return
      summary[tag] = { value, currency }
    }

    const endHandler = (id) => {
      if (id !== reqId) return
      clearTimeout(timer)
      ib.removeListener(EventName.accountSummary, dataHandler)
      ib.removeListener(EventName.accountSummaryEnd, endHandler)
      resolve({ accountId: acctId, summary })
    }

    ib.on(EventName.accountSummary, dataHandler)
    ib.on(EventName.accountSummaryEnd, endHandler)

    const tags = 'NetLiquidation,TotalCashValue,GrossPositionValue,UnrealizedPnL,RealizedPnL,BuyingPower'
    ib.reqAccountSummary(reqId, 'All', tags)

    timeout.catch((err) => {
      ib.cancelAccountSummary(reqId)
      ib.removeListener(EventName.accountSummary, dataHandler)
      ib.removeListener(EventName.accountSummaryEnd, endHandler)
      reject(err)
    })
  })
}

// ── Positions ───────────────────────────────────────────────────────────

export function getPositions() {
  ensureConnected()
  return new Promise((resolve, reject) => {
    const { timer, promise: timeout } = collectWithTimeout()
    const positions = []

    const dataHandler = (account, contract, pos, avgCost) => {
      if (pos !== 0) {
        positions.push({
          account,
          symbol: contract.symbol,
          secType: contract.secType,
          exchange: contract.exchange || contract.primaryExch,
          currency: contract.currency,
          conId: contract.conId,
          position: pos,
          avgCost,
        })
      }
    }

    const endHandler = () => {
      clearTimeout(timer)
      ib.removeListener(EventName.position, dataHandler)
      ib.removeListener(EventName.positionEnd, endHandler)
      resolve(positions)
    }

    ib.on(EventName.position, dataHandler)
    ib.on(EventName.positionEnd, endHandler)
    ib.reqPositions()

    timeout.catch((err) => {
      ib.cancelPositions()
      ib.removeListener(EventName.position, dataHandler)
      ib.removeListener(EventName.positionEnd, endHandler)
      reject(err)
    })
  })
}

// ── Executions (trades / filled orders) ─────────────────────────────────

export function getExecutions() {
  ensureConnected()
  const reqId = Math.floor(Math.random() * 100000) + 1000

  return new Promise((resolve, reject) => {
    const { timer, promise: timeout } = collectWithTimeout()
    const executions = []

    const dataHandler = (id, contract, execution) => {
      if (id !== reqId) return
      executions.push({
        symbol: contract.symbol,
        secType: contract.secType,
        currency: contract.currency,
        conId: contract.conId,
        execId: execution.execId,
        time: execution.time,
        side: execution.side,
        shares: execution.shares,
        price: execution.price,
        avgPrice: execution.avgPrice,
        account: execution.acctNumber,
        realizedPnL: execution.realizedPNL,
        orderId: execution.orderId,
      })
    }

    const endHandler = (id) => {
      if (id !== reqId) return
      clearTimeout(timer)
      ib.removeListener(EventName.execDetails, dataHandler)
      ib.removeListener(EventName.execDetailsEnd, endHandler)
      resolve(executions)
    }

    ib.on(EventName.execDetails, dataHandler)
    ib.on(EventName.execDetailsEnd, endHandler)

    // Empty filter = all recent executions
    ib.reqExecutions(reqId, {})

    timeout.catch((err) => {
      ib.removeListener(EventName.execDetails, dataHandler)
      ib.removeListener(EventName.execDetailsEnd, endHandler)
      reject(err)
    })
  })
}

// ── PnL per position ────────────────────────────────────────────────────

/**
 * Request PnL for a single position using reqPnLSingle.
 * Returns { dailyPnL, unrealizedPnL, realizedPnL, value, position }.
 */
export function getPositionPnL(acctId, conId) {
  ensureConnected()
  const reqId = Math.floor(Math.random() * 100000) + 1000

  return new Promise((resolve, reject) => {
    const { timer, promise: timeout } = collectWithTimeout(5000)

    const handler = (id, dailyPnL, unrealizedPnL, realizedPnL, value) => {
      if (id !== reqId) return
      clearTimeout(timer)
      ib.removeListener(EventName.pnlSingle, handler)
      ib.cancelPnLSingle(reqId)
      resolve({ dailyPnL, unrealizedPnL, realizedPnL, value })
    }

    ib.on(EventName.pnlSingle, handler)
    ib.reqPnLSingle(reqId, acctId, '', conId)

    timeout.catch((err) => {
      ib.removeListener(EventName.pnlSingle, handler)
      ib.cancelPnLSingle(reqId)
      reject(err)
    })
  })
}

/**
 * Request account-level daily PnL.
 * Returns { dailyPnL, unrealizedPnL, realizedPnL }.
 */
export function getAccountPnL(acctId) {
  ensureConnected()
  const reqId = Math.floor(Math.random() * 100000) + 1000

  return new Promise((resolve, reject) => {
    const { timer, promise: timeout } = collectWithTimeout(5000)

    const handler = (id, dailyPnL, unrealizedPnL, realizedPnL) => {
      if (id !== reqId) return
      clearTimeout(timer)
      ib.removeListener(EventName.pnl, handler)
      ib.cancelPnL(reqId)
      resolve({ dailyPnL, unrealizedPnL, realizedPnL })
    }

    ib.on(EventName.pnl, handler)
    ib.reqPnL(reqId, acctId, '')

    timeout.catch((err) => {
      ib.removeListener(EventName.pnl, handler)
      ib.cancelPnL(reqId)
      reject(err)
    })
  })
}

// ── Open Orders ─────────────────────────────────────────────────────────

export function getOpenOrders() {
  ensureConnected()
  return new Promise((resolve, reject) => {
    const { timer, promise: timeout } = collectWithTimeout()
    const orders = []

    const dataHandler = (orderId, contract, order, orderState) => {
      orders.push({
        orderId,
        symbol: contract.symbol,
        secType: contract.secType,
        action: order.action,
        totalQuantity: order.totalQuantity,
        orderType: order.orderType,
        lmtPrice: order.lmtPrice,
        auxPrice: order.auxPrice,
        status: orderState.status,
      })
    }

    const endHandler = () => {
      clearTimeout(timer)
      ib.removeListener(EventName.openOrder, dataHandler)
      ib.removeListener(EventName.openOrderEnd, endHandler)
      resolve(orders)
    }

    ib.on(EventName.openOrder, dataHandler)
    ib.on(EventName.openOrderEnd, endHandler)
    ib.reqAllOpenOrders()

    timeout.catch((err) => {
      ib.removeListener(EventName.openOrder, dataHandler)
      ib.removeListener(EventName.openOrderEnd, endHandler)
      reject(err)
    })
  })
}
