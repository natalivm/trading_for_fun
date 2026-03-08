const CACHE_NAME = 'tradingfun-v1';
const BASE_PATH = '/trading_for_fun/';

// Assets to precache on install
const PRECACHE_ASSETS = [
  BASE_PATH,
  BASE_PATH + 'index.html',
];

// Install event - cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  // Activate immediately instead of waiting
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();

  // Check for notification on activation (new deployment)
  checkForNotification();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CHECK_NOTIFICATION') {
    checkForNotification();
  }
});

// Check notification.json and show notification if enabled
async function checkForNotification() {
  try {
    // Bust cache to get the latest notification config
    const response = await fetch(BASE_PATH + 'notification.json?t=' + Date.now());
    if (!response.ok) return;

    const config = await response.json();

    if (config.enabled && config.title) {
      // Check if we already showed this version's notification
      const shown = await getShownVersion();
      if (shown === config.version) return;

      // Show the notification
      await self.registration.showNotification(config.title, {
        body: config.body || '',
        icon: BASE_PATH + 'icons/icon-192.png',
        badge: BASE_PATH + 'icons/icon-192.png',
        tag: 'tradingfun-update-' + config.version,
        data: { url: BASE_PATH },
        vibrate: [200, 100, 200],
      });

      // Mark this version as shown
      await saveShownVersion(config.version);

      // Notify all clients about the update
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: 'NEW_UPDATE',
          title: config.title,
          body: config.body,
          version: config.version,
        });
      });
    }
  } catch {
    // Silently fail - notification is non-critical
  }
}

// Use IndexedDB-like storage via Cache API for persistence
async function getShownVersion() {
  try {
    const cache = await caches.open('tradingfun-notification-state');
    const response = await cache.match('shown-version');
    if (response) return await response.text();
    return null;
  } catch {
    return null;
  }
}

async function saveShownVersion(version) {
  try {
    const cache = await caches.open('tradingfun-notification-state');
    await cache.put('shown-version', new Response(version));
  } catch {
    // Silently fail
  }
}

// Handle notification click - open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url.includes(BASE_PATH) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(event.notification.data?.url || BASE_PATH);
    })
  );
});
