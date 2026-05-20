const APP_VERSION = "1.4.7";
const CACHE_VERSION = "lift-v16";
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

const UI_LAYER_FIX_STYLE = `
<style id="lift-ui-layer-hotfix">
  :root {
    --bottom-nav-h: calc(82px + env(safe-area-inset-bottom, 0px));
    --bottom-nav-gap: 14px;
    --rest-fab-offset: 0px;
  }

  .status-bar-bg {
    height: env(safe-area-inset-top, 0px) !important;
    background: #f2f2f3 !important;
    z-index: 150 !important;
  }

  html[data-theme="dark"] .status-bar-bg {
    background: #161616 !important;
  }

  .topbar {
    padding-top: calc(env(safe-area-inset-top, 0px) + 4px) !important;
  }

  #app {
    padding-bottom: calc(var(--bottom-nav-h) + var(--rest-fab-offset) + 56px) !important;
    scroll-padding-bottom: calc(var(--bottom-nav-h) + var(--rest-fab-offset) + 56px) !important;
  }

  #app[data-has-rest-fab="true"] {
    --rest-fab-offset: var(--rest-fab-h, 132px);
  }

  .bottom-nav {
    min-height: var(--bottom-nav-h) !important;
    bottom: 0 !important;
    padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 10px) !important;
    background: var(--md-surface-container) !important;
    z-index: 92 !important;
  }

  .rest-fab {
    bottom: calc(var(--bottom-nav-h) + var(--bottom-nav-gap)) !important;
    z-index: 80 !important;
    background: var(--md-surface-container-high) !important;
  }

  .rest-fab[data-active="true"] {
    background: linear-gradient(135deg, rgb(255, 63, 106), rgb(255, 139, 31)) !important;
  }

  .toast-stack {
    bottom: calc(var(--bottom-nav-h) + var(--rest-fab-offset, 0px) + 24px) !important;
  }

  body[data-has-rest-fab="true"] .toast-stack {
    top: calc(env(safe-area-inset-top, 0px) + 132px) !important;
    bottom: auto !important;
  }

  .rest-fab[data-active="false"] {
    width: min(calc(100% - 64px), 360px) !important;
    border-radius: 999px !important;
    padding: 8px 10px !important;
    background: color-mix(in oklab, var(--md-surface-container-high) 94%, transparent) !important;
    color: var(--md-on-surface) !important;
  }

  .rest-fab[data-active="false"] .rest-main {
    grid-template-columns: 34px 1fr auto !important;
    gap: 8px !important;
  }

  .rest-fab[data-active="false"] .rest-presets {
    display: none !important;
  }

  .rest-fab[data-active="false"] .rest-ring,
  .rest-fab[data-active="false"] .rest-ring svg {
    width: 34px !important;
    height: 34px !important;
  }

  .rest-fab[data-active="false"] .rest-time {
    font-size: 16px !important;
    margin-top: 0 !important;
  }

  .rest-fab[data-active="false"] .rest-small {
    font-size: 10px !important;
  }

  .sheet-backdrop[data-open="true"][data-mode="modal"] {
    z-index: 130 !important;
    background: rgba(10, 10, 14, .52) !important;
  }

  .sheet[data-mode="modal"] {
    z-index: 140 !important;
    max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 8px) !important;
  }

  .sheet[data-mode="modal"] .sheet-body {
    max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 108px) !important;
    padding-bottom: calc(42px + env(safe-area-inset-bottom, 0px)) !important;
    overflow-y: auto !important;
  }

  .sheet-backdrop[data-open="true"][data-mode="page"] {
    opacity: 0 !important;
    pointer-events: none !important;
    background: transparent !important;
  }

  body:has(.sheet[data-mode="modal"][data-open="true"]) .bottom-nav,
  body.sheet-mode-modal .bottom-nav,
  body:has(.summary-overlay[data-open="true"]) .bottom-nav {
    transform: translate(-50%, 120%) !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }

  body:has(.sheet[data-mode="modal"][data-open="true"]) .rest-fab,
  body.sheet-mode-modal .rest-fab,
  body:has(.summary-overlay[data-open="true"]) .rest-fab {
    transform: translate(-50%, 140%) !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }

  body:has(.sheet[data-mode="page"][data-open="true"]) .bottom-nav,
  body.sheet-mode-page .bottom-nav {
    transform: translateX(-50%) !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
  }

  @supports not selector(body:has(*)) {
    body.sheet-mode-modal .bottom-nav,
    body.sheet-mode-modal .rest-fab {
      transform: translate(-50%, 120%) !important;
      opacity: 0 !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  }
</style>`;

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

  if (isIndexRequest(request, url)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.endsWith("/app.js")) {
    event.respondWith(networkFirstAppScript(request));
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
          await cache.put(request, await patchAppShellResponse(path, response));
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
      const patched = await patchIndexResponse(response);
      await cache.put(request, patched.clone());
      return patched;
    }
    return response;
  } catch (_) {
    const cachedRequest = await caches.match(request);
    if (cachedRequest) {
      return patchIndexResponse(cachedRequest);
    }

    const cachedIndex =
      (await caches.match("./index.html")) || (await caches.match("./"));
    if (cachedIndex) {
      return patchIndexResponse(cachedIndex);
    }

    return new Response("Offline and no cached app shell is available.", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}

async function networkFirstAppScript(request) {
  const cache = await caches.open(RUNTIME);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      const patched = await patchAppScriptResponse(response);
      await cache.put(request, patched.clone());
      return patched;
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request) || await caches.match("./app.js");
    if (cached) return patchAppScriptResponse(cached);
    return Response.error();
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

function isIndexRequest(request, url) {
  return request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html");
}

function isStaticRequest(request, url) {
  return STATIC_DESTINATIONS.has(request.destination) || STATIC_PATH_RE.test(url.pathname);
}

function shouldRefreshStatic(url) {
  return FRESH_STATIC_PATH_RE.test(url.pathname);
}

async function patchAppShellResponse(path, response) {
  if (path === "./" || path === "./index.html") return patchIndexResponse(response);
  if (path === "./app.js") return patchAppScriptResponse(response);
  return response;
}

async function patchIndexResponse(response) {
  const text = await response.text();
  let html = text;
  if (!html.includes('id="lift-ui-layer-hotfix"')) {
    html = html.replace("</head>", `${UI_LAYER_FIX_STYLE}\n</head>`);
  }
  const headers = copyHeaders(response.headers, "text/html; charset=utf-8");
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function patchAppScriptResponse(response) {
  const text = await response.text();
  const patched = patchAppScriptText(text);
  const headers = copyHeaders(response.headers, "text/javascript; charset=utf-8");
  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function copyHeaders(headers, contentType) {
  const next = new Headers(headers);
  next.set("Content-Type", contentType);
  next.set("X-Lift-Patched-Version", APP_VERSION);
  next.delete("Content-Length");
  return next;
}

function patchAppScriptText(source) {
  let out = source.replace(/var APP_VERSION = "[^"]+";/, `var APP_VERSION = "${APP_VERSION}";`);

  out = replaceFunction(out, "openSheet", "closeSheet", `  function openSheet(type, options, opts) {
    runtime.sheet = type;
    runtime.sheetMode = (opts && opts.mode) || "modal";
    if (type === "readiness") {
      var ds = dayState(state.activeDayId);
      runtime.readinessValue = ds.readiness || 8;
    }
    if (type === "plate" && options) {
      runtime.plate = options;
    }
    renderSheet();
    renderBottomNav();
    renderFab();
  }`);

  out = replaceFunction(out, "syncRestFabLayout", "renderBottomNav", `  function syncRestFabLayout() {
    var restFab = app.querySelector(".rest-fab");
    app.dataset.hasRestFab = String(!!restFab);
    var offset = restFab ? (restFab.offsetHeight + 22) + "px" : "0px";
    app.style.setProperty("--rest-fab-h", offset);
    document.body.style.setProperty("--rest-fab-offset", offset);
    document.body.dataset.hasRestFab = String(!!restFab);
  }`);

  out = replaceFunction(out, "renderBottomNav", "renderFab", `  function renderBottomNav() {
    var nav = document.getElementById("bottom-nav");
    if (!nav) return;
    var tab = runtime.activeTab || "today";
    var modalOpen = !!(runtime.sheet && runtime.sheetMode !== "page");
    nav.dataset.hidden = String(modalOpen);
    nav.setAttribute("aria-hidden", String(modalOpen));
    nav.querySelectorAll(".bottom-nav-btn").forEach(function (btn) {
      btn.dataset.active = String(btn.dataset.nav === tab);
      btn.tabIndex = modalOpen ? -1 : 0;
    });
  }`);

  out = replaceFunction(out, "renderRestFab", "renderSheet", `  function renderRestFab() {
    var remaining = restRemaining();
    var duration = Math.max(1, numberOr(rest.duration, state.settings.defaultRest));
    var showCompleted = numberOr(rest.completedAt, 0) > 0;
    var isVisible = !!(rest.running || remaining > 0 || showCompleted);
    if (!isVisible) return "";
    var isActive = !!rest.running;
    var progress = rest.running ? clamp(remaining / duration, 0, 1) : 0;
    var circumference = 2 * Math.PI * 22;
    var offset = circumference * (1 - progress);
    var html = '<aside class="rest-fab" data-active="' + String(isActive) + '">';
    html += '<div class="rest-main">';
    html += '<div class="rest-ring"><svg viewBox="0 0 52 52"><circle class="track" cx="26" cy="26" r="22"></circle><circle class="bar" cx="26" cy="26" r="22" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '"></circle></svg></div>';
    html += '<div><div class="rest-small">Rest timer</div><div class="rest-time" data-rest-time>' + formatDuration(remaining) + "</div></div>";
    html += '<div class="rest-actions">';
    html += '<button class="icon-btn" data-action="rest-adjust" data-delta="-15" aria-label="Subtract 15 seconds">' + icon("minus") + "</button>";
    html += '<button class="icon-btn primary" data-action="rest-toggle" aria-label="Play pause rest timer">' + icon(rest.running ? "pause" : "play") + "</button>";
    html += '<button class="icon-btn" data-action="rest-adjust" data-delta="15" aria-label="Add 15 seconds">' + icon("plus") + "</button>";
    html += "</div></div>";
    html += '<div class="rest-presets">';
    REST_PRESETS.concat([state.settings.defaultRest]).filter(function (value, index, arr) { return arr.indexOf(value) === index; }).forEach(function (seconds) {
      html += '<button class="preset" data-action="rest-preset" data-sec="' + seconds + '">' + formatDuration(seconds) + "</button>";
    });
    html += "</div></aside>";
    return html;
  }`);

  out = replaceFunction(out, "refreshTimers", "buildLog", `  function refreshTimers() {
    runtime.now = Date.now();
    document.querySelectorAll("[data-elapsed]").forEach(function (node) {
      node.textContent = formatDuration(workoutElapsed(node.dataset.elapsed));
    });
    var remaining = restRemaining();
    var restNode = document.querySelector("[data-rest-time]");
    if (restNode) restNode.textContent = formatDuration(remaining);
    var bar = document.querySelector(".rest-ring .bar");
    if (bar) {
      var duration = Math.max(1, numberOr(rest.duration, state.settings.defaultRest));
      var circumference = 2 * Math.PI * 22;
      var progress = rest.running ? clamp(remaining / duration, 0, 1) : 0;
      bar.setAttribute("stroke-dashoffset", String(circumference * (1 - progress)));
    }
    var fab = document.querySelector(".rest-fab");
    if (fab) {
      var nextActive = String(!!rest.running);
      if (fab.dataset.active !== nextActive) {
        fab.dataset.active = nextActive;
        if (typeof syncRestFabLayout === "function") syncRestFabLayout();
      } else {
        fab.dataset.active = nextActive;
      }
    }
    updateWorkoutNotification(false);
  }`);

  return out;
}

function replaceFunction(source, functionName, nextFunctionName, replacement) {
  const startMarker = `  function ${functionName}(`;
  const endMarker = `\n\n  function ${nextFunctionName}(`;
  const start = source.indexOf(startMarker);
  if (start < 0) return source;
  const end = source.indexOf(endMarker, start);
  if (end < 0) return source;
  return source.slice(0, start) + replacement + source.slice(end);
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
