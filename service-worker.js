const CACHE_NAME = 'hemodialysis-care-v20260611-1';

const APP_SHELL = [
  '/',
  '/dashboard.html',
  '/index.html',
  '/style.css',
  '/app.js',
  '/auth.js',
  '/supabase-client.js',
  '/supabase-config.js',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/images/Hemodialysis-Care jadi.png',
  '/assets/images/user_avatar.png',
  '/assets/images/user_avatar_female.png',
  '/assets/images/healthy_food.png',
  '/assets/images/exercise_care.png',
  '/assets/images/medicine_care.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
  );
});
