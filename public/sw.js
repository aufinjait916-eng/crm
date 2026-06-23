const CACHE_NAME = 'field-dynamics-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.jpg',
  '/icon.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Allow soft failure on individual assets during initial cache
      return Promise.allSettled(
        ASSETS.map(asset => {
          return cache.add(asset).catch(err => {
            console.warn(`Could not cache asset: ${asset}`, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass the service worker cache entirely for API routes and non-GET requests
  if (url.pathname.startsWith('/api/') || event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache, fetch in background to keep cache updated (stale-while-revalidate)
        fetch(event.request).then((response) => {
          if (
            response &&
            response.status === 200 &&
            response.type === 'basic' &&
            !url.pathname.includes('/@vite/') &&
            !url.pathname.includes('/node_modules/')
          ) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          }
        }).catch(() => {/* ignore network failures on revalidate */});
        
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Cache other GET static files dynamically
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic' &&
          !url.pathname.includes('/@vite/') &&
          !url.pathname.includes('/node_modules/')
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Fallback for HTML request when completely offline
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
