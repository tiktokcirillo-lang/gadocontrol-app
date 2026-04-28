// GadoControl Service Worker — v1.0
const CACHE_NAME = 'gadocontrol-v1';

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
