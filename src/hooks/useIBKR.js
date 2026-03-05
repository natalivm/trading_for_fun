import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export function useIBKR() {
  const [portfolio, setPortfolio] = useState(null)
  const [authStatus, setAuthStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [connected, setConnected] = useState(false)

  const fetchJson = useCallback(async (path) => {
    const res = await fetch(`${API_BASE}${path}`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(body.error || body.hint || `API error ${res.status}`)
    }
    return res.json()
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const status = await fetchJson('/api/status')
      setAuthStatus(status)
      setConnected(status.authenticated === true)
      return status.authenticated === true
    } catch {
      setConnected(false)
      return false
    }
  }, [fetchJson])

  const fetchPortfolio = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchJson('/api/portfolio')
      setPortfolio(data)
      setConnected(true)
    } catch (err) {
      setError(err.message)
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [fetchJson])

  const refresh = useCallback(async () => {
    // Keep the session alive
    try {
      await fetchJson('/api/tickle')
    } catch { /* ignore */ }
    await fetchPortfolio()
  }, [fetchJson, fetchPortfolio])

  // Initial load
  useEffect(() => {
    let cancelled = false

    async function init() {
      const authed = await checkAuth()
      if (!cancelled && authed) {
        await fetchPortfolio()
      } else if (!cancelled) {
        setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [checkAuth, fetchPortfolio])

  // Keep-alive every 55 seconds (gateway times out at 60s)
  useEffect(() => {
    if (!connected) return
    const interval = setInterval(async () => {
      try { await fetchJson('/api/tickle') } catch { /* ignore */ }
    }, 55_000)
    return () => clearInterval(interval)
  }, [connected, fetchJson])

  return {
    portfolio,
    authStatus,
    loading,
    error,
    connected,
    refresh,
    checkAuth,
  }
}
