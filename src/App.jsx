import { useState } from 'react'
import Header from './components/Header'
import CardList from './components/CardList'
import BottomNav from './components/BottomNav'
import NotificationBanner from './components/NotificationBanner'
import InstallPrompt from './components/InstallPrompt'
import { useServiceWorker } from './hooks/useServiceWorker'
import { useInstallPrompt } from './hooks/useInstallPrompt'

function App() {
  const { updateAvailable, dismissUpdate, requestNotificationPermission } = useServiceWorker()
  const { canInstall, install } = useInstallPrompt()
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )

  const handleEnableNotifications = async () => {
    const result = await requestNotificationPermission()
    setNotificationPermission(result)
  }

  return (
    <div className="flex min-h-screen min-h-dvh flex-col bg-slate-950">
      <Header />
      <NotificationBanner update={updateAvailable} onDismiss={dismissUpdate} />
      <InstallPrompt
        canInstall={canInstall}
        onInstall={install}
        notificationPermission={notificationPermission}
        onEnableNotifications={handleEnableNotifications}
      />
      <main className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <CardList />
      </main>
      <BottomNav />
    </div>
  )
}

export default App
