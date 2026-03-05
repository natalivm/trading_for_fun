import Card from './Card'

const placeholderCards = [
  {
    title: 'Portfolio Overview',
    subtitle: 'Your holdings at a glance',
    accent: 'emerald',
    content: (
      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-slate-100">$0.00</span>
          <span className="text-xs font-medium text-emerald-400">+0.00%</span>
        </div>
        <div className="h-24 rounded-xl bg-slate-800/50" />
      </div>
    ),
  },
  {
    title: 'Watchlist',
    subtitle: 'Tracked assets',
    accent: 'blue',
    content: (
      <div className="space-y-2">
        {['AAPL', 'TSLA', 'BTC'].map((ticker) => (
          <div key={ticker} className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-700/60" />
              <span className="text-sm font-medium text-slate-300">{ticker}</span>
            </div>
            <div className="h-4 w-16 rounded bg-slate-700/40" />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Recent Transactions',
    subtitle: 'Last 7 days',
    accent: 'violet',
    content: (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-slate-800/40 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-slate-700/60" />
              <div className="space-y-1">
                <div className="h-3 w-20 rounded bg-slate-700/40" />
                <div className="h-2.5 w-14 rounded bg-slate-800/60" />
              </div>
            </div>
            <div className="h-4 w-12 rounded bg-slate-700/40" />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Market Movers',
    subtitle: 'Top gainers today',
    accent: 'amber',
    content: (
      <div className="grid grid-cols-3 gap-2">
        {['GME', 'AMC', 'NVDA'].map((t) => (
          <div key={t} className="flex flex-col items-center rounded-xl bg-slate-800/40 px-2 py-3">
            <div className="h-7 w-7 rounded-full bg-slate-700/60" />
            <span className="mt-1.5 text-xs font-medium text-slate-400">{t}</span>
            <div className="mt-1 h-3 w-10 rounded bg-slate-700/40" />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'News & Insights',
    subtitle: 'Financial headlines',
    accent: 'rose',
    content: (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg bg-slate-800/40 p-3">
            <div className="h-3 w-3/4 rounded bg-slate-700/40" />
            <div className="mt-2 h-2.5 w-full rounded bg-slate-800/60" />
            <div className="mt-1 h-2.5 w-5/6 rounded bg-slate-800/60" />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Quick Actions',
    subtitle: 'Common tasks',
    accent: 'emerald',
    content: (
      <div className="grid grid-cols-2 gap-2">
        {['Buy', 'Sell', 'Transfer', 'Deposit'].map((action) => (
          <button
            key={action}
            className="rounded-xl bg-slate-800/50 px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
          >
            {action}
          </button>
        ))}
      </div>
    ),
  },
]

function CardList() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      {placeholderCards.map((card) => (
        <Card key={card.title} title={card.title} subtitle={card.subtitle} accent={card.accent}>
          {card.content}
        </Card>
      ))}
    </div>
  )
}

export default CardList
