/* Dangerous Munitions Near Me service worker
 * Cache version: dmnm-pwa-20261125-190742
 * - Pages (HTML navigations): network-first, bypassing the HTTP cache; falls back to the
 *   cached copy of that page, then to /offline.html.
 * - Data (/data/*.json, *.geojson, *.csv): network-first so records stay current; the last
 *   successful copy of each file is kept for offline use in a stable data cache that
 *   survives app updates (trimmed to the newest MAX_DATA_ENTRIES files).
 * - Static assets (css, js, images, icons, fonts, Leaflet): cache-first from a versioned cache.
 *   The version changes on every site build, so old static caches are deleted on activate.
 * - Other origins (map tiles, external links) are not touched.
 * No push notifications, no analytics, no data collection. Location is never seen here.
 */
const CACHE_VERSION = "dmnm-pwa-20261125-190742";
const CACHE_PREFIX = "dmnm-";
const SHELL_CACHE = CACHE_VERSION + "-shell";
const STATIC_CACHE = CACHE_VERSION + "-static";
const DATA_CACHE = "dmnm-data-v1";
const MAX_DATA_ENTRIES = 40;
const LOOKUP_CACHE = "dmnm-lookup-v1";
const MAX_LOOKUP_ENTRIES = 400;
const SHELL_URLS = ["/", "/index.html", "/offline.html", "/css/style.css", "/css/canada.css", "/js/app.js", "/favicon.svg", "/favicon.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-512-maskable.png", "/icons/apple-touch-icon.png", "/manifest.webmanifest", "/africa/index.html", "/js/africa.js", "/south-america/index.html", "/js/samerica.js", "/antarctica/index.html", "/js/antarctica.js", "/arctic/index.html", "/js/arctic.js", "/africa/south-africa/index.html", "/js/south-africa.js", "/middle-east/index.html", "/js/middle-east.js", "/petroleum/index.html", "/js/petroleum.js", "/asia/index.html", "/js/asia.js", "/topics/index.html", "/nuclear-tests/index.html", "/chemical-weapons/index.html", "/chemical-plants/index.html", "/nuclear-accidents/index.html", "/ranges/index.html", "/uxo/index.html", "/tailings/index.html", "/js/topic-map.js", "/russia-central-asia/index.html", "/mexico-central-america/index.html", "/js/regional-map.js", "/js/pwa-install.js", "/nearby.html", "/lookup.html", "/factsheet.html", "/js/fl-strings.js", "/js/fl-core.js", "/js/fl-lookup.js", "/js/fl-factsheet.js", "/css/fl.css", "/lib/qrcode/qrcode.js", "/data/lookup/manifest.json", "/js/i18n.js"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // Add one by one so a single missing page cannot break installation.
      return Promise.all(SHELL_URLS.map(function (url) {
        return fetch(url, { cache: "no-store" }).then(function (res) {
          if (res && res.ok) return cache.put(url, res);
        }).catch(function () {});
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        var mine = key.indexOf(CACHE_PREFIX) === 0;
        if (mine && key !== SHELL_CACHE && key !== STATIC_CACHE && key !== DATA_CACHE && key !== LOOKUP_CACHE) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function parse(url) {
  try { return new URL(url); } catch (e) { return null; }
}

function isData(u) {
  return u.pathname.indexOf("/data/") === 0 && /\.(json|geojson|csv)$/i.test(u.pathname);
}

function isStatic(u) {
  return /\.(css|js|mjs|png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|webmanifest)$/i.test(u.pathname);
}

function isNavigation(request) {
  if (request.mode === "navigate") return true;
  var accept = request.headers.get("accept") || "";
  return accept.indexOf("text/html") !== -1;
}

function trimCache(name, max) {
  return caches.open(name).then(function (cache) {
    return cache.keys().then(function (keys) {
      if (keys.length <= max) return;
      return cache.delete(keys[0]).then(function () { return trimCache(name, max); });
    });
  });
}

function aliasUrl(url) {
  var u = parse(url);
  if (!u) return null;
  if (/\/$/.test(u.pathname)) return u.origin + u.pathname + "index.html";
  if (/\/index\.html$/.test(u.pathname)) return u.origin + u.pathname.replace(/index\.html$/, "");
  return null;
}

function offlineResponse() {
  return new Response("Offline", {
    status: 503,
    statusText: "Offline",
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

function networkFirst(request, cacheName, opts) {
  opts = opts || {};
  return fetch(request, opts.fetch || {}).then(function (response) {
    if (response && response.ok) {
      var copy = response.clone();
      caches.open(cacheName).then(function (cache) {
        // Re-insert so the newest file is last (used for trimming).
        return cache.delete(request, { ignoreSearch: false }).then(function () {
          return cache.put(request, copy);
        });
      }).then(function () {
        if (opts.max) return trimCache(cacheName, opts.max);
      });
    }
    return response;
  }).catch(function () {
    return caches.match(request, { ignoreSearch: !!opts.ignoreSearch }).then(function (cached) {
      if (cached) return cached;
      var alt = aliasUrl(request.url);  // "/topics/" and "/topics/index.html" are the same page
      return alt ? caches.match(alt, { ignoreSearch: true }) : null;
    }).then(function (cached) {
      if (cached) return cached;
      if (opts.fallbackUrl) {
        return caches.match(opts.fallbackUrl).then(function (fb) { return fb || offlineResponse(); });
      }
      return offlineResponse();
    });
  });
}

function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (response) {
      if (response && response.ok && response.type === "basic") {
        var copy = response.clone();
        caches.open(STATIC_CACHE).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () { return offlineResponse(); });
  });
}

function isLookup(u) {
  return u.pathname.indexOf("/data/lookup/") === 0;
}

// Lookup tiles, record chunks and outlines: stale-while-revalidate in their own capped cache, so thousands of
// small files never crowd out the main data cache. Third-party geocoder replies are other-origin and never cached.
function staleWhileRevalidate(request, cacheName, max) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (hit) { return hit || caches.match(request); }).then(function (cached) {
      var net = fetch(request).then(function (res) {
        if (res && res.ok) {
          cache.put(request, res.clone()).then(function () { return trimCache(cacheName, max); });
        }
        return res;
      }).catch(function () { return cached || offlineResponse(); });
      return cached || net;
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var u = parse(request.url);
  if (!u || u.origin !== self.location.origin) return;
  if (u.pathname === "/sw.js") return;

  if (isLookup(u)) {
    event.respondWith(staleWhileRevalidate(request, LOOKUP_CACHE, MAX_LOOKUP_ENTRIES));
    return;
  }
  if (isData(u)) {
    event.respondWith(networkFirst(request, DATA_CACHE, { max: MAX_DATA_ENTRIES }));
    return;
  }
  if (isNavigation(request)) {
    event.respondWith(networkFirst(request, SHELL_CACHE, {
      fetch: { cache: "no-store" }, fallbackUrl: "/offline.html", ignoreSearch: true
    }));
    return;
  }
  if (isStatic(u)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  event.respondWith(networkFirst(request, SHELL_CACHE));
});
