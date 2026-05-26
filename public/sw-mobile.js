// Service Worker - Heavenly Dreams mobile PWA
const CACHE = 'hd-mobile-v2';
const PRECACHE = ['/m/', '/mobile.html', '/manifest-mobile.json', '/logo-192.png', '/logo-mobile.webp'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.registration.navigationPreload?.enable?.(),
      caches.keys().then(keys =>
        Promise.all(keys.filter(key => key.startsWith('hd-mobile') && key !== CACHE).map(key => caches.delete(key))),
      ),
    ]),
  );
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

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (event.request.mode === 'navigate' && url.pathname.startsWith('/m')) {
    event.respondWith(networkFirst(event.request, '/mobile.html'));
    return;
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/manifest-mobile.json' ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.png')
  ) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
