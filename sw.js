/* Dangerous Munitions Near Me service worker
 * Cache version: dmnm-pwa-20261125-143843
 * Network-first for /data/*.json and for same-origin pages/assets.
 * HTML navigations bypass the HTTP cache so phones pick up a new page quickly.
 * Precaches a small app shell and falls back to /offline.html.
 * No push notifications, no analytics, no data collection.
 */
const CACHE_VERSION = "dmnm-pwa-20261125-143843";
const SHELL_CACHE = CACHE_VERSION + "-shell";
const DATA_CACHE = CACHE_VERSION + "-data";
const SHELL_URLS = ["/", "/index.html", "/offline.html", "/css/style.css", "/css/canada.css", "/js/app.js", "/favicon.svg", "/favicon.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-512-maskable.png", "/icons/apple-touch-icon.png", "/manifest.webmanifest", "/africa/index.html", "/js/africa.js", "/south-america/index.html", "/js/samerica.js", "/antarctica/index.html", "/js/antarctica.js"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(SHELL_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== SHELL_CACHE && key !== DATA_CACHE) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function isSameOrigin(url) {
  try {
    return new URL(url).origin === self.location.origin;
  } catch (e) {
    return false;
  }
}

function isDataJson(url) {
  try {
    var u = new URL(url);
    return u.origin === self.location.origin &&
      u.pathname.indexOf("/data/") === 0 &&
      /\.json$/.test(u.pathname);
  } catch (e) {
    return false;
  }
}

function isNavigation(request) {
  if (request.mode === "navigate") return true;
  var accept = request.headers.get("accept") || "";
  return request.method === "GET" && accept.indexOf("text/html") !== -1;
}

function networkFirst(request, cacheName, fallbackUrl, fetchOpts) {
  return fetch(request, fetchOpts || {}).then(function (response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(cacheName).then(function (cache) {
        cache.put(request, copy);
      });
    }
    return response;
  }).catch(function () {
    return caches.match(request).then(function (cached) {
      if (cached) return cached;
      if (fallbackUrl) return caches.match(fallbackUrl);
      return new Response("Offline", {
        status: 503,
        statusText: "Offline",
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  if (!isSameOrigin(request.url)) return;

  if (isDataJson(request.url)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (isNavigation(request)) {
    event.respondWith(networkFirst(request, SHELL_CACHE, "/offline.html", { cache: "no-store" }));
    return;
  }

  event.respondWith(networkFirst(request, SHELL_CACHE));
});
