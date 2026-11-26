/* fl-lookup.js — worldwide distance lookup. Location stays in memory only (never in URL, storage or analytics). */
(function () {
  var F = window.FL, t = window.flT, esc = F.esc;
  var $ = function (id) { return document.getElementById(id); };
  var form = $("fl-form"), input = $("fl-q"), geoBtn = $("fl-geo"), radiusSel = $("fl-radius"), statusEl = $("fl-status"),
      choices = $("fl-choices"), out = $("fl-results"), listOnly = $("fl-listonly"), mapBtn = $("fl-map-btn"), mapBox = $("fl-map");
  var KM_PER_MI = 1.609344, PAGE = 25;
  var state = { center: null, label: "", results: [], shown: 0, map: null, mapLayer: null };
  var lastGeocode = 0;

  function unit() { var r = document.querySelector('input[name="fl-unit"]:checked'); return r ? r.value : "mi"; }
  function radiusKm() { var v = parseFloat(radiusSel.value); return unit() === "mi" ? v * KM_PER_MI : v; }
  function fmt(km) { var v = unit() === "mi" ? km / KM_PER_MI : km; return v < 10 ? v.toFixed(1) : String(Math.round(v)); }
  function uShort() { return t(unit() === "mi" ? "unit_mi_short" : "unit_km_short"); }
  function say(msg, isErr) { statusEl.textContent = msg; statusEl.classList.toggle("fl-error", !!isErr); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---- geocoding: Nominatim (1 request/second max, no autocomplete, never cached), Photon fallback ---- */
  function nominatim(q) {
    var wait = Math.max(0, 1100 - (Date.now() - lastGeocode));
    return sleep(wait).then(function () {
      lastGeocode = Date.now();
      var url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=0&q=" + encodeURIComponent(q) + "&accept-language=" + encodeURIComponent(window.FL_LANG || "en");
      return fetch(url, { credentials: "omit", cache: "no-store", referrerPolicy: "strict-origin-when-cross-origin" }).then(function (r) { if (!r.ok) throw new Error("nominatim " + r.status); return r.json(); });
    }).then(function (a) { return a.map(function (x) { return { lat: +x.lat, lon: +x.lon, label: x.display_name }; }); });
  }
  function photon(q) {
    var url = "https://photon.komoot.io/api/?limit=5&q=" + encodeURIComponent(q);
    return fetch(url, { credentials: "omit", cache: "no-store", referrerPolicy: "strict-origin-when-cross-origin" }).then(function (r) { if (!r.ok) throw new Error("photon " + r.status); return r.json(); }).then(function (j) {
      return (j.features || []).map(function (f) { var p = f.properties || {}; return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
        label: [p.name, p.street, p.city, p.state, p.country].filter(Boolean).join(", ") }; });
    });
  }
  function geocode(q) {
    /* Geocoder replies are never cached: not in memory, not in storage, not by the browser or the service worker. */
    return nominatim(q).catch(function () { return photon(q); });
  }

  /* ---- data loading: only the 2-degree tiles the search circle touches ---- */
  function tilesFor(la, lo, km, m) {
    var dLa = km / 111.2, dLo = km / (111.32 * Math.max(0.05, Math.cos(la * Math.PI / 180))), T = m.tile_deg, have = new Set(m.tiles), keys = [];
    var s = Math.max(-90, la - dLa), n = Math.min(89.999, la + dLa), w = lo - dLo, e = lo + dLo;
    for (var y = Math.floor(s / T); y <= Math.floor(n / T); y++)
      for (var x = Math.floor(w / T); x <= Math.floor(e / T); x++) {
        var xx = ((x * T + 180) % 360 + 360) % 360 - 180, k = y + "_" + Math.floor(xx / T);
        if (have.has(k) && keys.indexOf(k) < 0) keys.push(k);
      }
    return keys;
  }
  function search(la, lo, label) {
    state.center = [la, lo]; state.label = label;
    var km = radiusKm();
    say(t("status_loading", { place: label }));
    out.setAttribute("aria-busy", "true");
    return F.manifest().then(function (m) {
      var failed = false;
      var keys = tilesFor(la, lo, km, m);
      return Promise.all(keys.map(function (k) { return F.getJSON(F.DATA + "tiles/" + k + ".json").catch(function () { failed = true; return { p: [], a: [] }; }); })).then(function (tiles) {
        var res = [], seen = new Set(), areaCand = {};
        tiles.forEach(function (tl) {
          tl.p.forEach(function (p) {
            if (seen.has(p[2])) return;
            var d = F.haversine(la, lo, p[0], p[1]);
            if (d <= km) { seen.add(p[2]); res.push({ key: p[2], n: p[3], src: m.sources[p[4]], L: m.layers[p[5]], cat: m.cats[p[6]], st: p[7], v: p[8], ax: p[9], d: d, la: p[0], lo: p[1] }); }
          });
          tl.a.forEach(function (a) {
            if (areaCand[a[0]]) return;
            var b = a[8], dLa = km / 111.2, dLo = km / (111.32 * Math.max(0.05, Math.cos(la * Math.PI / 180)));
            if (la + dLa < b[0] || la - dLa > b[2] || lo + dLo < b[1] || lo - dLo > b[3]) return;
            areaCand[a[0]] = a;
          });
        });
        var files = {};
        Object.keys(areaCand).forEach(function (k) { files[areaCand[k][9]] = 1; });
        return Promise.all(Object.keys(files).map(function (g) { return F.getJSON(F.DATA + "ageo/" + g + ".json").catch(function () { failed = true; return {}; }); })).then(function (geos) {
          var G = {}; geos.forEach(function (o) { for (var k in o) G[k] = o[k]; });
          Object.keys(areaCand).forEach(function (k) {
            var a = areaCand[k], rings = G[k]; if (!rings || seen.has(k)) return;
            var d = F.polyDistance(la, lo, rings);
            if (d <= km) { seen.add(k); res.push({ key: k, n: a[1], src: m.sources[a[2]], L: m.layers[a[3]], cat: m.cats[a[4]], st: a[5], v: a[6], d: d, area: a[7], rings: rings }); }
          });
          res.sort(function (x, y) { return x.d - y.d || (x.n < y.n ? -1 : 1); });
          state.results = res; state.shown = 0;
          render(m, failed);
        });
      });
    }).catch(function () { say(t("err_data"), true); }).then(function () { out.removeAttribute("aria-busy"); });
  }

  function itemHtml(r, i) {
    var sheet = "factsheet.html?k=" + encodeURIComponent(r.key);
    var dist = r.d === 0 && r.area ? t("inside_area") : t("distance", { d: fmt(r.d), u: uShort() });
    var page = F.safeUrl(r.src.page);
    var areaNote = (r.ax ? '<p class="fl-area-note">' + esc(t("approx_note")) + "</p>" : "") + (r.area ? '<p class="fl-area-note">' + esc(t(r.area === "admin" ? "area_admin_note" : "area_outline_note")) + "</p>" : "");
    return '<li class="fl-item" id="fl-r' + i + '"><div class="fl-item-head"><span class="fl-num" aria-hidden="true">' + (i + 1) + "</span>" +
      '<h3 class="fl-name"><a href="' + esc(sheet) + '">' + esc(r.n) + "</a></h3></div>" +
      '<p class="fl-dist"><strong>' + esc(dist) + "</strong></p>" +
      '<dl class="fl-meta"><div><dt>' + esc(t("layer")) + "</dt><dd>" + esc(t("cat_" + r.cat)) + " · " + esc(r.L) + "</dd></div>" +
      "<div><dt>" + esc(t("source_layer")) + "</dt><dd>" + esc(r.src.label) + "</dd></div>" +
      (r.st ? "<div><dt>" + esc(t("status")) + "</dt><dd>" + esc(r.st) + "</dd></div>" : "") +
      "<div><dt>" + esc(t("verification")) + "</dt><dd>" + esc(F.vText(r.v, !r.v)) + "</dd></div></dl>" +
      '<p class="fl-risk">' + esc(t("risk_" + r.cat)) + "</p>" + areaNote +
      '<p class="fl-links"><a href="' + esc(sheet) + '">' + esc(t("open_sheet")) + '<span class="sr-only">: ' + esc(r.n) + "</span></a>" +
      (page ? ' <a href="' + esc(page) + '">' + esc(t("open_layer")) + '<span class="sr-only">: ' + esc(r.src.label) + "</span></a>" : "") + "</p></li>";
  }
  function render(m, failed) {
    var u = unit(), r = radiusSel.value, n = state.results.length;
    out.innerHTML = '<h2 id="fl-res-h" tabindex="-1">' + esc(t("results_heading")) + "</h2>" +
      (n ? '<p class="fl-small">' + esc(t("results_sorted")) + "</p>" : "") + '<p class="fl-small fl-caveat">' + esc(t("caveat")) + "</p>" +
      '<ol class="fl-list" id="fl-list"></ol><p id="fl-more-wrap"></p>';
    more();
    say((failed ? t("err_data") + " " : "") + (n ? t("status_done", { n: n, r: r, u: t(u === "mi" ? "unit_mi" : "unit_km"), place: state.label }) : t("status_none", { r: r, u: t(u === "mi" ? "unit_mi" : "unit_km"), place: state.label })), failed);
    mapBtn.hidden = false;
    if (state.map) drawMap();
    $("fl-res-h").focus();
  }
  function more() {
    var list = $("fl-list"), a = state.shown, b = Math.min(state.results.length, a + PAGE), html = "";
    for (var i = a; i < b; i++) html += itemHtml(state.results[i], i);
    list.insertAdjacentHTML("beforeend", html); state.shown = b;
    var wrap = $("fl-more-wrap"), left = state.results.length - b;
    wrap.innerHTML = state.results.length > PAGE ? '<span class="fl-small">' + esc(t("showing", { a: b, b: state.results.length })) + "</span> " +
      (left > 0 ? '<button type="button" id="fl-more" class="fl-btn fl-btn--ghost">' + esc(t("show_more", { n: Math.min(PAGE, left) })) + "</button>" : "") : "";
    var btn = $("fl-more");
    if (btn) btn.addEventListener("click", function () { var first = state.shown; more(); var el = $("fl-r" + first); if (el) { el.querySelector("a").focus(); } });
  }

  /* ---- map (lazy: Leaflet + tiles load only when the user opens it) ---- */
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    return new Promise(function (ok, bad) {
      var css = document.createElement("link"); css.rel = "stylesheet"; css.href = F.BASE + "lib/leaflet/leaflet.css"; document.head.appendChild(css);
      var s = document.createElement("script"); s.src = F.BASE + "lib/leaflet/leaflet.js"; s.onload = ok; s.onerror = bad; document.head.appendChild(s);
    });
  }
  function drawMap() {
    var L = window.L, c = state.center;
    if (!state.map) {
      state.map = L.map(mapBox, { scrollWheelZoom: false });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(state.map);
    }
    if (state.mapLayer) state.mapLayer.remove();
    state.map.setView(c, 10);
    var g = L.featureGroup();
    L.circle(c, { radius: radiusKm() * 1000, color: "#1e3a5f", weight: 2, fill: false, dashArray: "6 4", interactive: false }).addTo(g);
    L.marker(c, { title: t("map_you"), alt: t("map_you"), icon: L.divIcon({ className: "fl-pin-you", html: '<span aria-hidden="true">★</span>', iconSize: [28, 28] }) }).addTo(g);
    var groups = {};
    function line(r, i) { return "<li><strong>" + (i + 1) + ". " + esc(r.n) + "</strong> · " + esc(t("cat_" + r.cat)) + " · " + esc(r.d === 0 && r.area ? t("inside_area") : t("distance", { d: fmt(r.d), u: uShort() })) +
      ' · <a href="factsheet.html?k=' + esc(encodeURIComponent(r.key)) + '">' + esc(t("open_sheet")) + "</a></li>"; }
    state.results.slice(0, state.shown).forEach(function (r, i) {
      if (r.rings) { r.rings.forEach(function (ring) { L.polygon(ring.map(function (p) { return [p[1], p[0]]; }), { color: "#7c2d12", weight: 1.5, fillOpacity: r.area === "admin" ? 0.05 : 0.18, dashArray: r.area === "admin" ? "4 4" : null }).bindPopup('<ul class="fl-pop">' + line(r, i) + "</ul>").addTo(g); }); return; }
      var k = r.la.toFixed(4) + "," + r.lo.toFixed(4); (groups[k] = groups[k] || []).push([r, i]);
    });
    Object.keys(groups).forEach(function (k) {
      var gr = groups[k], r0 = gr[0][0], first = gr[0][1] + 1, label = gr.length > 1 ? first + "+" : String(first);
      var title = gr.length > 1 ? t("map_group", { n: gr.length, first: first }) : first + ". " + r0.n;
      L.marker([r0.la, r0.lo], { title: title, alt: title, icon: L.divIcon({ className: "fl-pin", html: "<span>" + label + "</span>", iconSize: [30, 26] }) })
        .bindPopup('<p class="fl-pop-h">' + esc(title) + '</p><ul class="fl-pop">' + gr.map(function (x) { return line(x[0], x[1]); }).join("") + "</ul>", { maxHeight: 260 }).addTo(g);
    });
    state.mapLayer = g.addTo(state.map);
    state.map.fitBounds(g.getBounds(), { padding: [8, 8] });
  }
  mapBtn.addEventListener("click", function () {
    var open = mapBox.hidden;
    mapBox.hidden = !open; mapBtn.setAttribute("aria-expanded", String(open)); mapBtn.textContent = t(open ? "map_hide" : "map_show");
    if (open) loadLeaflet().then(function () { drawMap(); state.map.invalidateSize(); });
  });

  /* ---- form ---- */
  function chooseFrom(list, q) {
    choices.innerHTML = '<p id="fl-choose-h">' + esc(t("choose_place")) + '</p><ul class="fl-choices" aria-labelledby="fl-choose-h">' + list.map(function (r, i) {
      return '<li><button type="button" class="fl-btn fl-btn--ghost" data-i="' + i + '">' + esc(r.label) + "</button></li>"; }).join("") + "</ul>";
    choices.hidden = false;
    choices.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { var r = list[+b.getAttribute("data-i")]; choices.hidden = true; search(r.lat, r.lon, r.label); }); });
    choices.querySelector("button").focus();
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault(); choices.hidden = true;
    var q = input.value.trim();
    if (!q) { say(t("err_empty"), true); input.focus(); return; }
    say(t("status_geocoding", { q: q }));
    geocode(q).then(function (list) {
      if (!list.length) { say(t("err_notfound", { q: q }), true); return; }
      var top = list[0], distinct = list.filter(function (r) { return F.haversine(r.lat, r.lon, top.lat, top.lon) > 30; });
      if (distinct.length) chooseFrom(list, q); else search(top.lat, top.lon, top.label);
    }).catch(function () { say(t("err_geocoder"), true); });
  });
  geoBtn.addEventListener("click", function () {
    if (!navigator.geolocation) { say(t("err_geo_unavail"), true); return; }
    say(t("status_geo"));
    navigator.geolocation.getCurrentPosition(function (p) { search(p.coords.latitude, p.coords.longitude, t("your_location")); },
      function (err) { say(t(err.code === 1 ? "err_geo_denied" : "err_geo_unavail"), true); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
  });
  function rerun() { if (state.center) search(state.center[0], state.center[1], state.label); }
  radiusSel.addEventListener("change", rerun);
  document.querySelectorAll('input[name="fl-unit"]').forEach(function (r) { r.addEventListener("change", function () { fillRadius(); rerun(); }); });
  function fillRadius() {
    var keep = radiusSel.selectedIndex < 0 ? 1 : radiusSel.selectedIndex, u = t(unit() === "mi" ? "unit_mi" : "unit_km");
    radiusSel.innerHTML = [5, 10, 25, 50].map(function (v) { return '<option value="' + v + '">' + v + " " + esc(u) + "</option>"; }).join("");
    radiusSel.selectedIndex = keep;
  }

  /* ---- list-only explanation ---- */
  function renderListOnly() {
    F.manifest().then(function (m) {
      var rows = m.sources.filter(function (s) { return m.counts[s.key].list_only; });
      listOnly.innerHTML = "<h2>" + esc(t("listonly_title")) + "</h2><p>" + esc(t("listonly_body", { n: m.totals.list_only.toLocaleString(), total: m.totals.records.toLocaleString() })) + "</p>" +
        '<details><summary>' + esc(t("listonly_table_n")) + '</summary><table class="fl-table"><thead><tr><th scope="col">' + esc(t("listonly_table_src")) + '</th><th scope="col">' + esc(t("listonly_table_n")) + "</th></tr></thead><tbody>" +
        rows.map(function (s) { var p = F.safeUrl(s.page); return "<tr><td>" + (p ? '<a href="' + esc(p) + '">' + esc(s.label) + "</a>" : esc(s.label)) + "</td><td>" + m.counts[s.key].list_only.toLocaleString() + "</td></tr>"; }).join("") +
        "</tbody></table></details>";
    }).catch(function () {});
  }
  window.flApplyStatic();
  fillRadius(); radiusSel.selectedIndex = 1;
  renderListOnly();
  window.FL_LOOKUP = { search: search, state: state }; /* test hook */
})();
