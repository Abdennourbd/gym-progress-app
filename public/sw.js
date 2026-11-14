/*
 * Makes the app work with no signal.
 *
 * The shell is cached so the app opens offline, and every request falls back to
 * the cache when the network is gone. Bump the version to throw away a
 * stale shell.
 */
const VERSION = 'gym-shell-v5';
const CACHE = VERSION;
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Tapping the "rest is over" notification should bring the app forward, not
// open a second copy.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) return client.focus();
        }
        return clients.openWindow('/');
      }),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /*
   * The api is never cached.
   *
   * A cached answer to "what is on this account?" belongs to whoever asked
   * it. On a shared phone the next person would be handed the previous
   * person's training the first time the network dropped, and the cache
   * cannot tell the two apart.
   *
   * The app does not need it either: everything you log is kept on the
   * device first, under your own account, and that copy is what the app
   * reads when there is no signal.
   */
  if (url.pathname.startsWith('/api/')) return;

  // The shell is served from the network when it can, so a new version is
  // picked up straight away, and from the cache when it cannot.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && cacheable(res)) {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const shell = await caches.match('/');
        if (shell) return shell;
        return Response.error();
      }),
  );
});

/**
 * Whether an answer is worth keeping.
 *
 * Anything that says it must not be stored, or that comes with a cookie of
 * its own, is left alone. A page that was made for one person should never
 * be handed to the next person who uses the phone.
 */
function cacheable(res) {
  const control = res.headers.get('cache-control') || '';
  if (control.includes('no-store') || control.includes('private')) return false;
  if (res.headers.get('set-cookie')) return false;
  return true;
}
