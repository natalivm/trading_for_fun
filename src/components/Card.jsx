function Card({ title, subtitle, children, accent = 'emerald' }) {
  const accentStyles = {
    emerald: 'border-emerald-500/20 hover:border-emerald-500/40',
    blue: 'border-blue-500/20 hover:border-blue-500/40',
    amber: 'border-amber-500/20 hover:border-amber-500/40',
    rose: 'border-rose-500/20 hover:border-rose-500/40',
    violet: 'border-violet-500/20 hover:border-violet-500/40',
  }

  return (
    <div
      className={`rounded-2xl border bg-slate-900/60 p-4 transition sm:p-5 ${accentStyles[accent] || accentStyles.emerald}`}
    >
      {title && (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

export default Card
