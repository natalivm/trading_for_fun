import { useState, useEffect, useCallback, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function AdminPanel() {
  const [trades, setTrades] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [yearFilter, setYearFilter] = useState('')
  const fileRef = useRef(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = yearFilter ? `?year=${yearFilter}` : ''
      const [tradesRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/db/trades${params}`),
        fetch(`${API_BASE}/api/db/stats${params}`),
      ])
      if (tradesRes.ok) setTrades(await tradesRes.json())
      if (statsRes.ok) setStats(await statsRes.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [yearFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setImporting(true)
    setImportResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API_BASE}/api/import`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      setImportResult(data)
      if (res.ok) {
        fetchData()
      }
    } catch (err) {
      setImportResult({ error: err.message })
    }

    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const years = [...new Set(trades.map(t => t.trade_date?.slice(0, 4)).filter(Boolean))].sort().reverse()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Import Section */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-300">Import Historical Trades</h3>
        <p className="mb-3 text-xs text-slate-500">
          Upload a CSV from IB Flex Query (Performance &amp; Reports &gt; Flex Queries). Include Symbol, Date, Side, Quantity, Price, and Realized P&amp;L columns.
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-300 file:cursor-pointer hover:file:bg-blue-500/30"
          />
          <button
            onClick={handleImport}
            disabled={importing}
            className="rounded-lg bg-blue-500/20 px-4 py-1.5 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/30 disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
        {importResult && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${importResult.error ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
            {importResult.error || importResult.message}
          </div>
        )}
      </div>

      {/* Stats Summary */}
      {stats && stats.total_trades > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3 text-center">
            <div className="text-[10px] text-slate-500">Total Trades</div>
            <div className="text-lg font-bold text-slate-200">{stats.total_trades}</div>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3 text-center">
            <div className="text-[10px] text-slate-500">Win / Lose</div>
            <div className="text-lg font-bold">
              <span className="text-emerald-400">{stats.winning_trades || 0}</span>
              <span className="text-slate-600"> / </span>
              <span className="text-red-400">{stats.losing_trades || 0}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3 text-center">
            <div className="text-[10px] text-slate-500">Total P&L</div>
            <div className={`text-lg font-bold ${(stats.total_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {(stats.total_pnl || 0) >= 0 ? '+' : ''}${(stats.total_pnl || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3 text-center">
            <div className="text-[10px] text-slate-500">Commissions</div>
            <div className="text-lg font-bold text-amber-400">
              ${(stats.total_commission || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      {/* Year Filter */}
      {years.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Filter:</span>
          <button
            onClick={() => setYearFilter('')}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${!yearFilter ? 'bg-slate-700/80 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
          >
            All
          </button>
          {years.map(y => (
            <button
              key={y}
              onClick={() => setYearFilter(y)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${yearFilter === y ? 'bg-slate-700/80 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Trades Table */}
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Loading trades...</div>
      ) : trades.length === 0 ? (
        <div className="py-8 text-center">
          <div className="text-sm text-slate-500">No trades found.</div>
          <div className="mt-1 text-xs text-slate-600">Import a CSV from IB Flex Query to see your trade history here.</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700/50">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-900/80">
                <th className="px-3 py-2 text-left text-slate-500">Date</th>
                <th className="px-3 py-2 text-left text-slate-500">Symbol</th>
                <th className="px-3 py-2 text-right text-slate-500">Side</th>
                <th className="px-3 py-2 text-right text-slate-500">Qty</th>
                <th className="px-3 py-2 text-right text-slate-500">Price</th>
                <th className="px-3 py-2 text-center text-slate-500">Ccy</th>
                <th className="px-3 py-2 text-right text-slate-500">P&L</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={t.id || i} className="border-b border-slate-800/50">
                  <td className="px-3 py-2 text-slate-400">{formatDate(t.trade_date)}</td>
                  <td className="px-3 py-2 font-semibold text-slate-200">{t.symbol}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${t.side === 'SLD' || t.side === 'S' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {t.side === 'SLD' || t.side === 'S' ? 'SELL' : 'BUY'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">{t.quantity}</td>
                  <td className="px-3 py-2 text-right text-slate-300">{t.price?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-center text-slate-500 text-[10px]">{t.currency || 'USD'}</td>
                  <td className={`px-3 py-2 text-right font-bold ${(t.realized_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(t.realized_pnl || 0) >= 0 ? '+' : ''}${(t.realized_pnl || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AdminPanel
