/* The Aspirant's Desk service worker — offline shell and Web Push. */
var VERSION = 'desk-v6-fresh-assets';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'config.js', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'];

/* Network-first files: scripts/styles, config (keys), service worker and data feeds. */
function isFresh(url) {
  var p = new URL(url).pathname;
  return /\/config\.js$/.test(p) || /\/data\/.*\.json$/.test(p) || /\/sw\.js$/.test(p);
}

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(VERSION).then(function (cache) {
    return Promise.all(SHELL.map(function (url) {
      return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key !== VERSION; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(function (response) {
      var copy = response.clone();
      caches.open(VERSION).then(function (cache) { cache.put('index.html', copy); });
      return response;
    }).catch(function () {
      return caches.match('index.html').then(function (cached) { return cached || caches.match('./'); });
    }));
    return;
  }

  /* Network-first for scripts, styles, config and data: latest when online, cached copy only offline. */
  if (isFresh(request.url)) {
    event.respondWith(fetch(request, { cache: 'no-store' }).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(VERSION).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () { return caches.match(request); }));
    return;
  }

  event.respondWith(caches.match(request).then(function (cached) {
    var network = fetch(request).then(function (response) {
      if (response && response.ok) {
        var copy = response.clone();
        caches.open(VERSION).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () { return cached; });
    return cached || network;
  }));
});

self.addEventListener('push', function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  var title = data.title || "The Aspirant's Desk";
  var options = {
    body: data.body || 'Your daily study reminder is ready.',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'desk-daily-reminder',
    renotify: false,
    data: { url: data.url || './#mistakes' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target;
  try { target = new URL((event.notification.data && event.notification.data.url) || './#mistakes', self.location.href); }
  catch (e) { target = new URL('./#mistakes', self.location.href); }
  if (target.origin !== self.location.origin) target = new URL('./#mistakes', self.location.href);
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
    for (var i = 0; i < clients.length; i++) {
      if (new URL(clients[i].url).origin === self.location.origin) {
        if (clients[i].navigate) clients[i].navigate(target.href);
        return clients[i].focus();
      }
    }
    return self.clients.openWindow(target.href);
  }));
});
