/* fl-core.js — shared helpers for lookup.html and factsheet.html (no dependencies). */
(function () {
  var BASE = (document.currentScript && document.currentScript.getAttribute("data-base")) || "";
  var DATA = BASE + "data/lookup/";
  var cache = {};
  function getJSON(url) {
    if (!cache[url]) cache[url] = fetch(url, { credentials: "omit" }).then(function (r) { if (!r.ok) throw new Error(r.status + " " + url); return r.json(); });
    return cache[url];
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function safeUrl(u) { u = String(u || ""); return /^(https?:)?\/\//i.test(u) || /^[a-z0-9._\/-]+(\.html|\/)([?#].*)?$/i.test(u) ? u : ""; }
  function hash(s) { var x = 0; for (var i = 0; i < s.length; i++) x = (Math.imul(x, 31) + s.charCodeAt(i)) >>> 0; return x; }
  var manifestP = null;
  function manifest() { return manifestP || (manifestP = getJSON(DATA + "manifest.json")); }
  function record(key) {
    var i = key.indexOf(":"), src = key.slice(0, i), id = key.slice(i + 1);
    return manifest().then(function (m) {
      var n = m.chunks[src]; if (!n) return null;
      return getJSON(DATA + "rec/" + src + "-" + (hash(id) % n) + ".json").then(function (c) { return c[id] || null; });
    });
  }
  var R = 6371.0088;
  function rad(d) { return d * Math.PI / 180; }
  function haversine(la1, lo1, la2, lo2) {
    var dla = rad(la2 - la1), dlo = rad(lo2 - lo1);
    var a = Math.sin(dla / 2) * Math.sin(dla / 2) + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dlo / 2) * Math.sin(dlo / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  /* Distance (km) from (la,lo) to polygon rings [[lon,lat],...]; 0 if inside. Local equirectangular projection (fine for < ~200 km). */
  function polyDistance(la, lo, rings) {
    var kx = R * rad(1) * Math.cos(rad(la)), ky = R * rad(1), best = Infinity, inside = false;
    rings.forEach(function (ring) {
      var pin = false;
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var dx = ring[i][0] - lo; var dxj = ring[j][0] - lo;
        if (dx > 180) dx -= 360; if (dx < -180) dx += 360; if (dxj > 180) dxj -= 360; if (dxj < -180) dxj += 360;
        var xi = dx * kx, yi = (ring[i][1] - la) * ky, xj = dxj * kx, yj = (ring[j][1] - la) * ky;
        if (((yi > 0) !== (yj > 0)) && (0 < (xj - xi) * (0 - yi) / (yj - yi) + xi)) pin = !pin;
        var vx = xj - xi, vy = yj - yi, L2 = vx * vx + vy * vy, t = L2 ? Math.max(0, Math.min(1, -(xi * vx + yi * vy) / L2)) : 0;
        var px = xi + t * vx, py = yi + t * vy, d = Math.sqrt(px * px + py * py);
        if (d < best) best = d;
      }
      if (pin) inside = true;
    });
    return inside ? 0 : best;
  }
  function vText(v, reg) {
    var map = { v: "verified", c: "corrected", u: "unverified", p: "partly verified" };
    v = map[v] || v;
    if (v) return flT("v_" + v);
    return reg ? flT("v_register") : flT("v_none");
  }
  window.FL = { BASE: BASE, DATA: DATA, getJSON: getJSON, esc: esc, safeUrl: safeUrl, hash: hash, manifest: manifest, record: record,
                haversine: haversine, polyDistance: polyDistance, vText: vText, SITE: "https://dangerousmunitionsnearme.com/" };
})();
