import { memo } from 'react'
import { toUSD } from '../../utils/constants'
import { formatDate } from './helpers'

function CumulativePnLChart({ closedPositions, width = 500, height = 120 }) {
  if (!closedPositions || closedPositions.length < 2) {
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Cumulative P&L — Closed Trades</h3>
        <span className="text-[11px] text-slate-600 italic">Need more closed trades to chart</span>
      </div>
    )
  }

  const sorted = [...closedPositions]
    .filter(p => p.closeDate)
    .sort((a, b) => (a.closeDate || '').localeCompare(b.closeDate || ''))
  const points = sorted.reduce((acc, p) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].value : 0
    const value = prev + toUSD((p.profitDollar || 0) - (p.fees || 0), p.currency)
    return [...acc, { date: p.closeDate, value, ticker: p.ticker }]
  }, [])

  const values = points.map(p => p.value)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1
  const padTop = 8
  const padBottom = 20

  const chartH = height - padTop - padBottom
  const yForVal = v => padTop + chartH - ((v - min) / range) * chartH
  const zeroY = yForVal(0)

  const pathPoints = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width
    const y = yForVal(p.value)
    return { x, y }
  })

  const linePath = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${pathPoints[pathPoints.length - 1].x},${zeroY} L${pathPoints[0].x},${zeroY} Z`

  const lastVal = values[values.length - 1]
  const isUp = lastVal >= 0
  const strokeColor = isUp ? '#34d399' : '#f472b6'
  const fillColor = isUp ? 'rgba(52,211,153,0.12)' : 'rgba(244,114,182,0.10)'

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cumulative P&L — Closed Trades</h3>
        <span className="text-sm font-bold tabular-nums" style={{ color: strokeColor }}>
          {lastVal >= 0 ? '+' : '-'}${Math.abs(lastVal).toFixed(0)}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full">
        <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
        <path d={areaPath} fill={fillColor} />
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {pathPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={strokeColor} opacity="0.7" />
        ))}
        <text x="4" y={height - 4} fill="#475569" fontSize="9" fontFamily="monospace">{formatDate(points[0].date)}</text>
        <text x={width - 4} y={height - 4} fill="#475569" fontSize="9" fontFamily="monospace" textAnchor="end">{formatDate(points[points.length - 1].date)}</text>
      </svg>
    </div>
  )
}

export default memo(CumulativePnLChart)
