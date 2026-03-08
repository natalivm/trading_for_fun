import { useEffect, useRef, useState } from 'react';

const BASE_PATH = '/trading_for_fun/';

export function useServiceWorker() {
  const [registration, setRegistration] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(null);
  const updateIntervalRef = useRef(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Listen for messages from the service worker
    const handleMessage = (event) => {
      if (event.data?.type === 'NEW_UPDATE') {
        setUpdateAvailable({
          title: event.data.title,
          body: event.data.body,
          version: event.data.version,
        });
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Register the service worker
    navigator.serviceWorker
      .register(BASE_PATH + 'sw.js', { scope: BASE_PATH })
      .then((reg) => {
        setRegistration(reg);

        // Check for updates periodically (every 30 minutes)
        updateIntervalRef.current = setInterval(() => reg.update(), 30 * 60 * 1000);
      })
      .catch(() => {
        // Service worker registration failed - non-critical
      });

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      clearInterval(updateIntervalRef.current);
    };
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return await Notification.requestPermission();
  };

  const dismissUpdate = () => setUpdateAvailable(null);

  return { registration, updateAvailable, dismissUpdate, requestNotificationPermission };
}
