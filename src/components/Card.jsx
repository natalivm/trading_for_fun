import { ACCENT_STYLES } from '../utils/constants'

function Card({ title, subtitle, children, accent = 'emerald' }) {
  return (
    <div
      className={`rounded-2xl border bg-slate-900/60 p-4 transition sm:p-5 ${ACCENT_STYLES[accent] || ACCENT_STYLES.emerald}`}
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
