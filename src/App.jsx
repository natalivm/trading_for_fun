import Header from './components/Header'
import Positions from './components/PositionTabs'
import IBKRStatus from './components/IBKRStatus'
import NotificationBanner from './components/NotificationBanner'
import InstallPrompt from './components/InstallPrompt'
import ErrorBoundary from './components/ErrorBoundary'
import { useServiceWorker } from './hooks/useServiceWorker'
import { useIBKR } from './hooks/useIBKR'
import { useInstallPrompt } from './hooks/useInstallPrompt'

function App() {
  const { updateAvailable, dismissUpdate } = useServiceWorker()
  const { portfolio, loading, error, connected, refresh } = useIBKR()
  const { canInstall, install } = useInstallPrompt()

  return (
    <div className="flex min-h-screen min-h-dvh flex-col bg-slate-950 text-slate-100">
      <Header portfolio={portfolio} />
      <NotificationBanner update={updateAvailable} onDismiss={dismissUpdate} />
      <IBKRStatus connected={connected} loading={loading} error={error} onRefresh={refresh} portfolio={portfolio} />

      <main className="flex-1 overflow-y-auto scrollbar-hide pb-8 pt-2">
        <InstallPrompt canInstall={canInstall} onInstall={install} />
        <ErrorBoundary>
          <Positions ibkrData={portfolio} />
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default App
