const CACHE_VERSION = "lift-v3";
const PRECACHE = `${CACHE_VERSION}-precache`;
const RUNTIME = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./data.js",
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
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/icon-maskable-512.png"
];

const STATIC_DESTINATIONS = new Set([
  "font",
  "image",
  "manifest",
  "script",
  "style"
]);

const STATIC_PATH_RE = /\.(?:css|js|mjs|json|webmanifest|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$/i;

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
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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

  if (isStaticRequest(request, url)) {
    event.respondWith(cacheFirstStatic(request));
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

function isStaticRequest(request, url) {
  return STATIC_DESTINATIONS.has(request.destination) || STATIC_PATH_RE.test(url.pathname);
}
