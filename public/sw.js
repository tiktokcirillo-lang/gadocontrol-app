// GadoControl Service Worker — v1.1
const CACHE_NAME = 'gadocontrol-v2';

// Recursos essenciais para funcionamento offline
const PRECACHE_URLS = [
  '/',
  '/app',
  '/login',
];

// ── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch — Network first, fallback to cache ───────────────────────────────
self.addEventListener('fetch', (event) => {
  // Só intercepta GETs de navegação e assets
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Deixa Firebase e APIs externas passarem direto
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('firebaseapp') ||
    url.hostname.includes('asaas')
  ) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Armazena cópia no cache se for resposta válida
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'GadoControl', body: 'Você tem um lembrete no rebanho.' };
  try {
    if (event.data) data = event.data.json();
  } catch { /* usa default */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'gadocontrol',
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
