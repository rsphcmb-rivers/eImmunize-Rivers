// eImmunize Nigeria — Service Worker
// Provides offline capability via cache-first strategy

const CACHE_NAME = 'eimmunize-ng-v1';
const OFFLINE_URLS = [
  './',
  './eRegister_Facility.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4',
];

// ── INSTALL: cache all app shells ──────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(OFFLINE_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: clean old caches ─────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── FETCH: cache-first, network fallback ───────────────────────────
self.addEventListener('fetch', function(event) {
  // Skip non-GET and Supabase API calls (always need network for DB)
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        // Cache successful responses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./eRegister_Facility.html');
        }
      });
    })
  );
});

// ── BACKGROUND SYNC ───────────────────────────────────────────────
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-immunization-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Notify all clients to run their sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_NOW' });
  });
}

// ── PUSH NOTIFICATIONS (for future use) ──────────────────────────
self.addEventListener('push', function(event) {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'eImmunize Nigeria', {
      body: data.body || 'You have a new immunization reminder.',
      icon: './icon-192.png',
      badge: './icon-72.png',
      tag: data.tag || 'eimm-reminder',
      data: data.url || './',
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || './')
  );
});
