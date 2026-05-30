// Service Worker — Heavenly Dreams CRM
const CACHE = 'hd-crm-v5';
const PRECACHE = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

async function cachePut(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    await cachePut(fallbackUrl || request, response);
    return response;
  } catch {
    return (await caches.match(fallbackUrl || request)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fresh = fetch(request)
    .then(response => {
      cachePut(request, response);
      return response;
    })
    .catch(() => null);
  return cached || fresh;
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(networkFirst(e.request, '/index.html'));
    return;
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.json' ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico')
  ) {
    e.respondWith(staleWhileRevalidate(e.request));
  }
});
