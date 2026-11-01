// Iron Log offline cache.
// Keeps the app itself on the device so it opens with no signal.
// Your workout data is cached separately by Firestore and syncs when you're back online.
// Bump VERSION whenever you deploy changes, so phones pick up the new files.
const VERSION = "iron-log-v53";
const FIREBASE_SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
// Exercise demo GIFs (same pinned base as public/exercise-gifs.js). Two caches that outlive app versions: pictures seen while
// training (at most DEMO_KEEP, oldest dropped) and the ones saved by "Download exercise pictures" (never trimmed).
const DEMO_BASE = "https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd/";
const DEMO_CACHE = "ironlog-demo", DEMO_ALL = "ironlog-demo-all", DEMO_KEEP = 80;

const APP_SHELL = [
  "/",
  "/index.html",
  "/firebase-config.js",
  "/workout-tools.js",
  "/exercise-library.js",
  "/exercise-info.js",
  "/backup.js",
  "/food-table.js",
  "/barcode.js",
  "/progression.js",
  "/bodyweight.js",
  "/injuries.js",
  "/deload.js",
  "/energy.js",
  "/achievements.js",
  "/nav.js",
  "/badge-art.js",
  "/celebrate.js",
  "/ui-helpers.js",
  "/i18n.js",
  "/lang-ar.js",
  "/theme-tools.js",
  "/looks.js",
  "/looks.css",
  "/looks/layout.js",
  "/looks/carbon.js",
  "/looks/bloom.js",
  "/looks/today-parts.js",
  "/looks-carbon.css",
  "/looks-bloom.css",
  "/exercise-gifs.js",
  "/exercise-catalog.js",
  "/lang-ar-catalog.js",
  "/injuries-catalog.js",
  "/exercise-search.js",
  "/social.js",
  "/friends.js",
  "/overview.js",
  "/plan-tools.js",
  "/safety.js",
  "/challenges.js",
  "/privacy.html",
  "/terms.html",
  "/licenses.html",
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
    await Promise.all(keys.filter(k => k !== VERSION && !k.startsWith("ironlog-demo")).map(k => caches.delete(k)));
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

// Demo pictures: the downloaded set first, then the seen-while-training cache, then the network (and remember it).
async function demoFetch(request) {
  const all = await caches.open(DEMO_ALL);
  const saved = await all.match(request.url);
  if (saved) return saved;
  const cache = await caches.open(DEMO_CACHE);
  const seen = await cache.match(request.url);
  if (seen) return seen;
  const response = await fetch(request);
  if (response && response.ok) {
    try {   // a full storage must not fail a picture the network did deliver
      await cache.put(request.url, response.clone());
      const keys = await cache.keys();
      for (let i = 0; i < keys.length - DEMO_KEEP; i++) await cache.delete(keys[i]);
    } catch (e) {}
  }
  return response;
}
async function tellClients(msg) { for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(msg); }
// The page asks for: a status count, a download of a list of URLs (4 at a time, skipping saved ones, resumable) or a clear.
self.addEventListener("message", event => {
  const d = event.data || {};
  if (d.type === "demo-status") event.waitUntil((async () => {
    // counts only the pictures the page still wants (d.urls) and drops the stale rest, so a changed picture list can be downloaded again
    const wanted = Array.isArray(d.urls) ? new Set(d.urls.filter(u => typeof u === "string")) : null, all = await caches.open(DEMO_ALL);
    let cached = 0;
    for (const k of await all.keys()) { if (wanted && !wanted.has(k.url)) await all.delete(k); else cached++; }
    const seen = (await (await caches.open(DEMO_CACHE)).keys()).length;
    await tellClients({ type: "demo-status", cached, seen });
  })());
  else if (d.type === "demo-clear") event.waitUntil((async () => { await caches.delete(DEMO_ALL); await caches.delete(DEMO_CACHE); await tellClients({ type: "demo-status", cached: 0, seen: 0 }); })());
  else if (d.type === "demo-download" && Array.isArray(d.urls)) event.waitUntil((async () => {
    const urls = d.urls.filter(u => typeof u === "string" && u.startsWith(DEMO_BASE)), cache = await caches.open(DEMO_ALL);
    for (const k of await cache.keys()) if (!urls.includes(k.url)) await cache.delete(k);   // stale: no longer in the picture list
    let done = 0, failed = 0, next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const url = urls[next++];
        try { if (!(await cache.match(url))) { const r = await fetch(url, { mode: "cors" }); if (!r.ok) throw new Error(r.status); await cache.put(url, r); } }
        catch (e) { failed++; }
        done++; if (done % 5 === 0 || done === urls.length) await tellClients({ type: "demo-progress", done, total: urls.length });
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    await tellClients({ type: "demo-done", total: urls.length, failed });
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never touch sign-in or database traffic; Firebase handles those itself.
  if (url.pathname.startsWith("/__/")) return;

  if (DEMO_BASE && req.url.startsWith(DEMO_BASE)) { event.respondWith(demoFetch(req)); return; }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (url.href.startsWith(FIREBASE_SDK) || url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(req));
  }
  // Everything else (Firestore, Google sign-in) goes straight to the network.
});
