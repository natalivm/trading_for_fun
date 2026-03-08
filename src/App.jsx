import Header from './components/Header'
import Positions from './components/PositionTabs'
import NotificationBanner from './components/NotificationBanner'
import InstallPrompt from './components/InstallPrompt'
import ErrorBoundary from './components/ErrorBoundary'
import { useServiceWorker } from './hooks/useServiceWorker'
import { useIBKR } from './hooks/useIBKR'
import { useInstallPrompt } from './hooks/useInstallPrompt'

function App() {
  const { updateAvailable, dismissUpdate } = useServiceWorker()
  const { portfolio } = useIBKR()
  const { canInstall, install } = useInstallPrompt()

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen min-h-dvh flex-col bg-slate-950 text-slate-100">
        <Header portfolio={portfolio} />
        <NotificationBanner update={updateAvailable} onDismiss={dismissUpdate} />

        <main className="flex-1 overflow-y-auto scrollbar-hide pb-8 pt-2">
          <InstallPrompt canInstall={canInstall} onInstall={install} />
          <Positions ibkrData={portfolio} />
        </main>
      </div>
    </ErrorBoundary>
  )
}

export default App
