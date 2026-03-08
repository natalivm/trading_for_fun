import { memo } from 'react'
import QuickStats from './QuickStats'
import CumulativePnLChart from './CumulativePnLChart'
import ActivityHeatmap from './ActivityHeatmap'

function PortfolioOverview({ allTrades, closedPositions }) {
  return (
    <div className="flex flex-col gap-7 px-2 sm:px-4">
      <QuickStats allTrades={allTrades} closedPositions={closedPositions} />
      <CumulativePnLChart closedPositions={closedPositions} />
      <ActivityHeatmap allTrades={allTrades} />
    </div>
  )
}

export default memo(PortfolioOverview)
