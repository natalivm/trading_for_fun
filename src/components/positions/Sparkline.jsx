import { memo } from 'react'

const Sparkline = memo(function Sparkline({ data, width = 200, height = 32 }) {
  if (!data || data.length < 2) return null
  const values = data.map(d => d.avg_cost)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const lastVal = values[values.length - 1]
  const firstVal = values[0]
  const color = lastVal >= firstVal ? '#34d399' : '#f87171'

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
})

export default Sparkline
