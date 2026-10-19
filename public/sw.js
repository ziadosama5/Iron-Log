// Iron Log offline cache.
// Keeps the app itself on the device so it opens with no signal.
// Your workout data is cached separately by Firestore and syncs when you're back online.
// Bump VERSION whenever you deploy changes, so phones pick up the new files.
const VERSION = "iron-log-v31";
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2/";

const APP_SHELL = [
  "/",
  "/index.html",
  "/firebase-config.js",
  "/workout-tools.js",
  "/exercise-library.js",
  "/exercise-info.js",
  "/backup.js",
  "/energy.js",
  "/achievements.js",
  "/nav.js",
  "/badge-art.js",
  "/celebrate.js",
  "/ui-helpers.js",
  "/i18n.js",
  "/lang-ar.js",
  "/theme-tools.js",
  "/social.js",
  "/friends.js",
  "/plan-tools.js",
  "/safety.js",
  "/challenges.js",
  "/privacy.html",
  "/terms.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/logo-mark.svg",
  FIREBASE_SDK + "firebase-app.js",
  FIREBASE_SDK + "firebase-auth.js",
  FIREBASE_SDK + "firebase-firestore.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Cache each file on its own so one slow file doesn't fail the whole install.
    await Promise.all(APP_SHELL.map(url => cache.add(new Request(url, { cache: "reload" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Network first with a short timeout for the app's own files (so updates arrive when online,
// but a weak gym signal falls back to the saved copy within 3 seconds).
async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
    ]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: true })
      || (request.mode === "navigate" ? await cache.match("/index.html") : null);
    if (cached) return cached;
    throw e;
  }
}

// Cache first for versioned libraries and fonts, which never change at the same address.
async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never touch sign-in or database traffic; Firebase handles those itself.
  if (url.pathname.startsWith("/__/")) return;

  // Exercise drawings never change at the same address within a VERSION, so serve them from
  // the cache once seen (they are saved on first view, not at install, to keep install light).
  if (url.origin === self.location.origin && url.pathname.startsWith("/exercises/")) {
    event.respondWith(cacheFirst(req));
  } else if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (url.href.startsWith(FIREBASE_SDK) || url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(req));
  }
  // Everything else (Firestore, Google sign-in) goes straight to the network.
});
