import Header from './components/Header'
import Positions from './components/PositionTabs'
import IBKRStatus from './components/IBKRStatus'
import NotificationBanner from './components/NotificationBanner'
import { useServiceWorker } from './hooks/useServiceWorker'
import { useIBKR } from './hooks/useIBKR'

function App() {
  const { updateAvailable, dismissUpdate } = useServiceWorker()
  const { portfolio, loading, error, connected, refresh } = useIBKR()

  return (
    <div className="flex min-h-screen min-h-dvh flex-col bg-slate-950">
      <Header />
      <NotificationBanner update={updateAvailable} onDismiss={dismissUpdate} />

      <main className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4 pt-4 sm:px-6 lg:px-8">
        <IBKRStatus
          connected={connected}
          loading={loading}
          error={error}
          onRefresh={refresh}
          portfolio={portfolio}
        />
        <Positions ibkrData={portfolio} />
      </main>
    </div>
  )
}

export default App
