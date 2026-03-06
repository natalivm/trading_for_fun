function IBKRStatus({ connected, loading, error, onRefresh, portfolio }) {
  if (loading) {
    return (
      <div className="mx-auto mb-4 max-w-3xl">
        <div className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/60 px-4 py-2.5">
          <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <span className="text-xs text-slate-400">Connecting to IBKR...</span>
        </div>
      </div>
    )
  }

  if (error && !portfolio) {
    return (
      <div className="mx-auto mb-4 max-w-3xl">
        <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-950/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-400" />
            <span className="text-xs text-red-300">IBKR disconnected</span>
            <span className="text-[10px] text-red-400/60">{error}</span>
          </div>
          <button
            onClick={onRefresh}
            className="rounded-full bg-red-500/20 px-3 py-1 text-[10px] font-semibold text-red-300 transition hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (connected) {
    return (
      <div className="mx-auto mb-4 max-w-3xl">
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-950/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-emerald-300">IBKR Connected</span>
            <span className="text-[10px] text-emerald-400/60">Live data</span>
          </div>
          <button
            onClick={onRefresh}
            className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/30"
          >
            Refresh
          </button>
        </div>
      </div>
    )
  }

  // Show static data status with timestamp
  if (portfolio?.static && portfolio?.updatedAt) {
    const updated = new Date(portfolio.updatedAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    return (
      <div className="mx-auto mb-4 max-w-3xl">
        <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-950/30 px-4 py-2.5">
          <div className="h-2 w-2 rounded-full bg-blue-400" />
          <span className="text-xs text-blue-300">Saved portfolio</span>
          <span className="text-[10px] text-blue-400/60">Updated {updated}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto mb-4 max-w-3xl">
      <div className="flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900/60 px-4 py-2.5">
        <div className="h-2 w-2 rounded-full bg-slate-500" />
        <span className="text-xs text-slate-400">Using saved positions (IBKR not connected)</span>
      </div>
    </div>
  )
}

export default IBKRStatus
