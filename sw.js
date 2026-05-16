const CACHE_VERSION = "lift-v10";
const PRECACHE = `${CACHE_VERSION}-precache`;
const RUNTIME = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./data.js",
  "./version.json",
  "./features/achievements.js",
  "./features/records.js",
  "./features/summary.js",
  "./features/rings.js",
  "./features/heatmap.js",
  "./features/recap.js",
  "./features/steps.js",
  "./features/journal.js",
  "./features/cloud.js",
  "./features/library.js",
  "./features/notifications.js",
  "./features/voice.js",
  "./features/measurements.js",
  "./features/strength.js",
  "./features/streaks.js",
  "./features/calendar.js",
  "./features/marketplace.js",
  "./features/healthkit.js",
  "./features/forms.js",
  "./features/quickadd.js",
  "./manifest.webmanifest",
  "./screenshots/lift-mobile-home.png",
  "./screenshots/lift-desktop-dashboard.png",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/badge.png"
];

const STATIC_DESTINATIONS = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "style"
]);

const STATIC_PATH_RE = /\.(?:css|js|mjs|json|webmanifest|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$/i;
const FRESH_STATIC_PATH_RE = /\.(?:css|js|mjs|json|webmanifest)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PRECACHE && key !== RUNTIME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .then(() => notifyClientsOfUpdate())
  );
});

self.addEventListener("message", (event) => {
  const message = event.data || {};
  if (message.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (message.type === "LIFT_NOTIF_SHOW") {
    event.waitUntil(showLiftNotification(message.payload, { silent: false }));
    return;
  }
  if (message.type === "LIFT_NOTIF_UPDATE") {
    event.waitUntil(showLiftNotification(message.payload, { silent: true }));
    return;
  }
  if (message.type === "LIFT_NOTIF_CLEAR") {
    event.waitUntil(clearLiftNotification());
  }
});

self.addEventListener("notificationclick", (event) => {
  const action = event.action || "open";
  event.notification.close();
  event.waitUntil(handleLiftNotificationClick(action));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Always fetch version.json from the network so update checks see live data.
  if (url.pathname.endsWith("/version.json")) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => caches.match("./version.json"))
    );
    return;
  }

  if (isStaticRequest(request, url)) {
    event.respondWith(shouldRefreshStatic(url) ? networkFirstStatic(request) : cacheFirstStatic(request));
  }
});

async function precacheAppShell() {
  const cache = await caches.open(PRECACHE);

  await Promise.all(
    APP_SHELL.map(async (path) => {
      try {
        const request = new Request(path, { cache: "reload" });
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response);
        }
      } catch (_) {
        // Keep install resilient if a static asset is missing during local edits.
      }
    })
  );
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(RUNTIME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cachedRequest = await caches.match(request);
    if (cachedRequest) {
      return cachedRequest;
    }

    const cachedIndex =
      (await caches.match("./index.html")) || (await caches.match("./"));
    if (cachedIndex) {
      return cachedIndex;
    }

    return new Response("Offline and no cached app shell is available.", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstStatic(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return (await caches.match(request)) || (await caches.match("./index.html")) || Response.error();
  }
}

function isStaticRequest(request, url) {
  return STATIC_DESTINATIONS.has(request.destination) || STATIC_PATH_RE.test(url.pathname);
}

function shouldRefreshStatic(url) {
  return FRESH_STATIC_PATH_RE.test(url.pathname);
}

async function notifyClientsOfUpdate() {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: "LIFT_SW_UPDATED" }));
}

async function showLiftNotification(payload, options = {}) {
  if (!payload || !payload.title) return;
  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  await self.registration.showNotification(payload.title, {
    tag: payload.tag || "lift-workout",
    body: payload.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/badge.png",
    requireInteraction: true,
    renotify: false,
    silent: !!options.silent,
    data: payload.data || { ts: Date.now() },
    actions
  });
}

async function clearLiftNotification() {
  const notifications = await self.registration.getNotifications({ tag: "lift-workout" });
  notifications.forEach((notification) => notification.close());
}

async function handleLiftNotificationClick(action) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const client = clients.find((candidate) => candidate.url.startsWith(self.registration.scope));
  if (client) {
    client.postMessage({ type: "LIFT_NOTIF_ACTION", action });
    return client.focus();
  }
  return self.clients.openWindow(`./?notifAction=${encodeURIComponent(action)}`);
}
