import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function SnapshotDetail({ snapshot }) {
  if (!snapshot) return null

  const { longPositions = [], shortPositions = [], closedLongPositions = [], closedShortPositions = [] } = snapshot
  const allPositions = [...longPositions, ...shortPositions]
  const allClosed = [...closedLongPositions, ...closedShortPositions]

  const totalInvested = longPositions.reduce((s, p) => s + p.entryPrice * p.quantity, 0)
  const totalProfit = allClosed.reduce((s, p) => s + (p.profitDollar || 0), 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3 text-center">
          <div className="text-[10px] text-slate-500">Positions</div>
          <div className="text-lg font-bold text-slate-200">{allPositions.length}</div>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3 text-center">
          <div className="text-[10px] text-slate-500">Invested</div>
          <div className="text-lg font-bold text-slate-200">${totalInvested.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3 text-center">
          <div className="text-[10px] text-slate-500">P&L</div>
          <div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalProfit >= 0 ? '+' : ''}${totalProfit.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Open Positions Table */}
      {allPositions.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Open Positions</h4>
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/80">
                  <th className="px-3 py-2 text-left text-slate-500">Symbol</th>
                  <th className="px-3 py-2 text-right text-slate-500">Side</th>
                  <th className="px-3 py-2 text-right text-slate-500">Qty</th>
                  <th className="px-3 py-2 text-right text-slate-500">Avg Cost</th>
                  <th className="px-3 py-2 text-right text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {allPositions.map((p, i) => {
                  const isLong = longPositions.includes(p)
                  const total = p.entryPrice * p.quantity
                  return (
                    <tr key={i} className="border-b border-slate-800/50">
                      <td className="px-3 py-2 font-semibold text-slate-200">{p.ticker}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${isLong ? 'text-blue-400' : 'text-orange-400'}`}>
                        {isLong ? 'Long' : 'Short'}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">{p.quantity}</td>
                      <td className="px-3 py-2 text-right text-slate-300">${p.entryPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-200">${total.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Closed Positions Table */}
      {allClosed.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Closed Positions</h4>
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-900/80">
                  <th className="px-3 py-2 text-left text-slate-500">Symbol</th>
                  <th className="px-3 py-2 text-right text-slate-500">Qty</th>
                  <th className="px-3 py-2 text-right text-slate-500">Entry</th>
                  <th className="px-3 py-2 text-right text-slate-500">Exit</th>
                  <th className="px-3 py-2 text-right text-slate-500">P&L</th>
                </tr>
              </thead>
              <tbody>
                {allClosed.map((p, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="px-3 py-2 font-semibold text-slate-200">{p.ticker}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{p.quantity}</td>
                    <td className="px-3 py-2 text-right text-slate-300">${p.entryPrice.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-slate-300">${(p.exitPrice || 0).toLocaleString()}</td>
                    <td className={`px-3 py-2 text-right font-bold ${(p.profitDollar || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(p.profitDollar || 0) >= 0 ? '+' : ''}${(p.profitDollar || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminPanel() {
  const [snapshots, setSnapshots] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/history`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setSnapshots(data)
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/history/${selectedId}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setDetail(data)
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [selectedId])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl text-center py-12">
        <span className="text-sm text-slate-500">Loading history...</span>
      </div>
    )
  }

  if (snapshots.length === 0) {
    return (
      <div className="mx-auto max-w-3xl text-center py-12">
        <div className="text-slate-500 text-sm">No historical data yet.</div>
        <div className="text-slate-600 text-xs mt-1">Connect to IB Gateway and fetch portfolio data to start recording history.</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h3 className="text-sm font-semibold text-slate-300">Portfolio Snapshots</h3>

      {/* Snapshot list */}
      <div className="space-y-2">
        {snapshots.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
              selectedId === s.id
                ? 'border-blue-500/40 bg-blue-950/30'
                : 'border-slate-700/50 bg-slate-900/60 hover:border-slate-600/50'
            }`}
          >
            <div>
              <span className="text-sm font-semibold text-slate-200">{formatDateTime(s.fetched_at)}</span>
              <span className="ml-2 text-[10px] text-slate-500">{s.account_id}</span>
            </div>
            <svg
              className={`h-4 w-4 text-slate-500 transition-transform ${selectedId === s.id ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ))}
      </div>

      {/* Selected snapshot detail */}
      {selectedId && detail && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4">
          <SnapshotDetail snapshot={detail} />
        </div>
      )}
    </div>
  )
}

export default AdminPanel
