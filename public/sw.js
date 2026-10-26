const CACHE_VERSION = 'v7';
const STATIC_CACHE = `project-velvet-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `project-velvet-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `project-velvet-images-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const API_HOSTS_TO_SKIP = ['supabase.co', 'supabase.io'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => {
            return (
              name.startsWith('project-velvet-') &&
              name !== STATIC_CACHE &&
              name !== DYNAMIC_CACHE &&
              name !== IMAGE_CACHE
            ) || name.startsWith('riley-companion-');
          })
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return API_HOSTS_TO_SKIP.some((host) => url.hostname.includes(host));
}

function isFontRequest(url) {
  return FONT_HOSTS.some((host) => url.hostname.includes(host));
}

function isImageRequest(request) {
  return request.destination === 'image';
}

function isStaticAsset(url) {
  return (
    url.pathname.match(/\.(js|css|woff2?|ttf|otf)$/) ||
    url.pathname.startsWith('/assets/')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (isApiRequest(url)) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  if (isFontRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  if (isImageRequest(request)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, 30 * 24 * 60 * 60 * 1000));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 7 * 24 * 60 * 60 * 1000));
    return;
  }

  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

async function cacheFirst(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    const fetchDate = cached.headers.get('sw-fetched-at');
    if (!maxAgeMs || !fetchDate || Date.now() - Number(fetchDate) < maxAgeMs) {
      return cached;
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('sw-fetched-at', Date.now().toString());
      const cloned = new Response(await response.clone().arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, cloned);
    }
    return response;
  } catch {
    return cached || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.destination === 'document') {
      const fallback = await cache.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise || new Response('Offline', { status: 503 });
}

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

// ---- Phone notifications ----
// The server sends { title, body, tag, url, data }. A browser requires every push to show something, so this
// always does; the server already skips people who are looking at the app.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { /* not JSON */ }
  const title = data.title || 'Velvet';
  event.waitUntil((async () => {
    const tag = data.tag || 'velvet';
    // Several messages in the same chat become one notification ("3 new messages") instead of a stack.
    const existing = await self.registration.getNotifications({ tag });
    const count = existing.length ? ((existing[0].data && existing[0].data.count) || 1) + 1 : 1;
    await self.registration.showNotification(title, {
      body: count > 1 ? count + ' new messages' : (data.body || ''),
      tag,
      renotify: true,
      icon: '/icon-192.png',
      badge: '/icon-96.png',
      data: Object.assign({}, data.data, { url: data.url || '/lobby', count }),
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const url = d.url || '/lobby';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // The app is already open: bring it forward and tell it which chat to open, without reloading.
    for (const w of windows) {
      if ('focus' in w) {
        await w.focus();
        w.postMessage({ type: 'velvet:open-im', conversationId: d.conversationId, senderId: d.senderId, senderName: d.senderName });
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
