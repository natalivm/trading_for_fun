/**
 * IBKR Client Portal API service layer.
 *
 * The Client Portal Gateway must be running locally (default https://localhost:5000).
 * Download it from: https://www.interactivebrokers.com/en/trading/ib-api.php
 *
 * All requests are proxied through this service so that the browser never
 * talks to the gateway directly (avoids CORS / self-signed cert issues).
 */

const GATEWAY_URL = process.env.IBKR_GATEWAY_URL || 'https://localhost:5000'

async function ibkrFetch(path, options = {}) {
  const url = `${GATEWAY_URL}/v1/api${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    // The IB Gateway uses a self-signed certificate
    ...(process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0'
      ? {}
      : {}),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const err = new Error(`IBKR API ${res.status}: ${body || res.statusText}`)
    err.status = res.status
    throw err
  }

  return res.json()
}

// ── Authentication ──────────────────────────────────────────────────────

export async function getAuthStatus() {
  return ibkrFetch('/iserver/auth/status', { method: 'POST' })
}

export async function reauthenticate() {
  return ibkrFetch('/iserver/reauthenticate', { method: 'POST' })
}

export async function tickle() {
  return ibkrFetch('/tickle', { method: 'POST' })
}

// ── Account ─────────────────────────────────────────────────────────────

export async function getAccounts() {
  return ibkrFetch('/iserver/accounts')
}

export async function getAccountSummary(accountId) {
  return ibkrFetch(`/portfolio/${accountId}/summary`)
}

// ── Positions ───────────────────────────────────────────────────────────

export async function getPositions(accountId, pageId = 0) {
  return ibkrFetch(`/portfolio/${accountId}/positions/${pageId}`)
}

// ── Orders ──────────────────────────────────────────────────────────────

export async function getLiveOrders() {
  return ibkrFetch('/iserver/account/orders')
}

export async function getOrderHistory(accountId, { days = 7 } = {}) {
  // Flex-style order history via the /pa endpoint
  return ibkrFetch(`/iserver/account/orders?accountId=${accountId}&days=${days}`)
}

// ── Trades (filled orders) ──────────────────────────────────────────────

export async function getTrades(days = 7) {
  return ibkrFetch(`/iserver/account/trades?days=${days}`)
}
