import { useState } from 'react'
import Header from './components/Header'
import Positions from './components/PositionTabs'
import AdminPanel from './components/AdminPanel'
import IBKRStatus from './components/IBKRStatus'
import NotificationBanner from './components/NotificationBanner'
import { useServiceWorker } from './hooks/useServiceWorker'
import { useIBKR } from './hooks/useIBKR'

function App() {
  const { updateAvailable, dismissUpdate } = useServiceWorker()
  const { portfolio, loading, error, connected, refresh } = useIBKR()
  const [activeTab, setActiveTab] = useState('client')

  return (
    <div className="flex min-h-screen min-h-dvh flex-col bg-slate-950">
      <Header />
      <NotificationBanner update={updateAvailable} onDismiss={dismissUpdate} />

      {/* Client / Admin tabs */}
      <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="flex rounded-xl border border-slate-700/50 bg-slate-900/60 p-1">
          <button
            onClick={() => setActiveTab('client')}
            className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-200 ${
              activeTab === 'client'
                ? 'bg-slate-700/80 text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Client
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-200 ${
              activeTab === 'admin'
                ? 'bg-slate-700/80 text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Admin
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4 pt-4 sm:px-6 lg:px-8">
        <IBKRStatus
          connected={connected}
          loading={loading}
          error={error}
          onRefresh={refresh}
        />
        {activeTab === 'client' ? (
          <Positions ibkrData={portfolio} />
        ) : (
          <AdminPanel />
        )}
      </main>
    </div>
  )
}

export default App
