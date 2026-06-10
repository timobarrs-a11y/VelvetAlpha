const CACHE_VERSION = 'v3';
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
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    }).then(() => self.skipWaiting())
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

  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
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
