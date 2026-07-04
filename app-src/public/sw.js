// Scripture Gym / KDM member portal service worker.
//
// What this does today:
//  - Registers the app as installable (works with manifest.json)
//  - Caches the app shell for basic offline resilience
//  - Listens for 'push' events and displays them as notifications —
//    this is the receiving half of push notifications
//
// What this does NOT do yet:
//  - Nothing currently SENDS a push to this service worker. That needs
//    a server-side scheduler (cron / scheduled edge function) that
//    doesn't exist in this project yet, plus a stored push subscription
//    per user. See the build notepad for the full explanation. This
//    file is ready for that day — no changes needed here when it comes.

const CACHE_NAME = "kdm-app-shell-v1";
const APP_SHELL = ["./", "./index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for navigation/app requests, falling back to cache when offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Receiving half of push notifications — inert until something server-side
// actually sends a push, but ready the moment that exists.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Scripture Gym";
  const options = {
    body: data.body || "Time for a rep.",
    icon: "icon-192.png",
    badge: "icon-192.png",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
