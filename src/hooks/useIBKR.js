import { useState, useEffect, useCallback } from 'react'
import { fetchJson } from '../utils/apiClient'

// Static JSON path — works on both dev (Vite serves public/) and GitHub Pages
const STATIC_DATA_URL = `${import.meta.env.BASE_URL}data/portfolio.json`

export function useIBKR() {
  const [portfolio, setPortfolio] = useState(null)
  const [authStatus, setAuthStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [connected, setConnected] = useState(false)

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
  }, [])

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
  }, [])

  // Fallback: load from static JSON file (for GitHub Pages / offline)
  const loadStaticData = useCallback(async () => {
    try {
      const res = await fetch(STATIC_DATA_URL)
      if (!res.ok) return false
      const data = await res.json()
      setPortfolio({ ...data, static: true })
      return true
    } catch {
      return false
    }
  }, [])

  const refresh = useCallback(async () => {
    // Keep the session alive
    try {
      await fetchJson('/api/tickle')
    } catch { /* ignore */ }
    await fetchPortfolio()
  }, [fetchPortfolio])

  // Initial load
  useEffect(() => {
    let cancelled = false

    async function init() {
      const authed = await checkAuth()
      if (!cancelled) {
        if (authed) {
          await fetchPortfolio()
        } else {
          // Server offline or not authenticated — try static JSON
          const loaded = await loadStaticData()
          if (!loaded) setLoading(false)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [checkAuth, fetchPortfolio, loadStaticData])

  // Keep-alive every 55 seconds (gateway times out at 60s)
  useEffect(() => {
    if (!connected) return
    const interval = setInterval(async () => {
      try { await fetchJson('/api/tickle') } catch { /* ignore */ }
    }, 55_000)
    return () => clearInterval(interval)
  }, [connected])

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
