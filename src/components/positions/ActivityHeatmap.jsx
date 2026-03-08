import { memo } from 'react'

function ActivityHeatmap({ allTrades }) {
  const activityMap = {}
  for (const p of allTrades) {
    if (p.openDate) activityMap[p.openDate] = (activityMap[p.openDate] || 0) + 1
    if (p.closeDate) activityMap[p.closeDate] = (activityMap[p.closeDate] || 0) + 1
  }

  const year = 2026
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  const startDay = new Date(jan1)
  while (startDay.getDay() !== 1) startDay.setDate(startDay.getDate() - 1)
  const endDay = new Date(dec31)
  while (endDay.getDay() !== 5) endDay.setDate(endDay.getDate() + 1)

  const weeks = []
  const cursor = new Date(startDay)
  while (cursor <= endDay) {
    const week = []
    for (let d = 0; d < 5; d++) {
      const dateStr = cursor.toISOString().slice(0, 10)
      const inYear = cursor.getFullYear() === year && cursor >= jan1 && cursor <= dec31
      week.push({ date: dateStr, count: activityMap[dateStr] || 0, inYear })
      cursor.setDate(cursor.getDate() + 1)
    }
    cursor.setDate(cursor.getDate() + 2)
    weeks.push(week)
  }

  const maxCount = Math.max(1, ...Object.values(activityMap))
  const cellSize = 18, gap = 3

  const getColor = (count, inYear) => {
    if (!inYear) return 'transparent'
    if (count === 0) return 'rgba(30,41,59,0.18)'
    const intensity = Math.min(count / maxCount, 1)
    if (intensity <= 0.25) return '#064e3b'
    if (intensity <= 0.5) return '#059669'
    if (intensity <= 0.75) return '#34d399'
    return '#6ee7b7'
  }

  const months = []
  let lastMonth = -1
  for (let w = 0; w < weeks.length; w++) {
    const firstValid = weeks[w].find(d => d.inYear)
    if (firstValid) {
      const m = new Date(firstValid.date).getMonth()
      if (m !== lastMonth) {
        months.push({ label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m], week: w })
        lastMonth = m
      }
    }
  }

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const labelW = 36
  const svgW = weeks.length * (cellSize + gap) + labelW
  const svgH = 5 * (cellSize + gap) + 26

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Trading Activity — {year}</h3>
      <div className="overflow-x-auto">
        <svg width={svgW} height={svgH} className="block">
          {dayLabels.map((label, i) => (
            <text key={i} x={0} y={24 + i * (cellSize + gap) + cellSize / 2 + 1}
              fill="#94a3b8" fontSize="11" fontFamily="system-ui" dominantBaseline="middle">{label}</text>
          ))}
          {months.map(({ label, week }) => (
            <text key={label} x={labelW + week * (cellSize + gap)} y={11}
              fill="#94a3b8" fontSize="11" fontWeight="500" fontFamily="system-ui">{label}</text>
          ))}
          {weeks.map((week, wi) =>
            week.map((day, di) => (
              <rect key={`${wi}-${di}`}
                x={labelW + wi * (cellSize + gap)}
                y={20 + di * (cellSize + gap)}
                width={cellSize} height={cellSize} rx={3}
                fill={getColor(day.count, day.inYear)}
                stroke={day.count > 0 && day.inYear ? 'rgba(52,211,153,0.2)' : 'none'}
                strokeWidth={0.5}
              >
                {day.inYear && <title>{day.date}: {day.count} trade{day.count !== 1 ? 's' : ''}</title>}
              </rect>
            ))
          )}
        </svg>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[11px] text-slate-400">Less</span>
        {['rgba(30,41,59,0.18)', '#064e3b', '#059669', '#34d399', '#6ee7b7'].map((c, i) => (
          <div key={i} className="rounded-sm" style={{ width: cellSize, height: cellSize, background: c }} />
        ))}
        <span className="text-[11px] text-slate-400">More</span>
      </div>
    </div>
  )
}

export default memo(ActivityHeatmap)
