/* Africa section map (local preview). Leaflet only; no tracking beyond the site's GA4 tag. */
(function () {
  "use strict";
  var script = document.currentScript, base = script.getAttribute("data-base") || "";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function load(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }
  var LAYERS = [
    { k: "uxo", label: "Landmine / UXO (whole province or country)", col: "#b91c1c", fill: "#fca5a5" },
    { k: "mil", label: "U.S. military (airfield-level)", col: "#1e3a8a", fill: "#93c5fd" },
    { k: "blast", label: "Depot explosion", col: "#7c2d12", fill: "#fb923c" },
    { k: "mine", label: "Mining operation", col: "#3f6212", fill: "#bef264" }
  ];
  var VL = { verified: (window.DMNM_I18N ? DMNM_I18N.t("status.verified", "Verified") : "Verified"), corrected: (window.DMNM_I18N ? DMNM_I18N.t("status.corrected", "Corrected") : "Corrected"), unverified: (window.DMNM_I18N ? DMNM_I18N.t("status.unverified", "Unverified") : "Unverified") };
  Promise.all([load(base + "data/africa.json"), load(base + "data/africa-uxo-areas.json")]).then(function (r) {
    var d = r[0], areas = r[1], byId = {};
    d.sites.forEach(function (s) { byId[s.id] = s; });
    var el = document.getElementById("map"); if (!el || typeof L === "undefined") return;
    var map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(map);
    map.fitBounds([[-35, -18], [37.5, 52]]);
    var groups = {}; LAYERS.forEach(function (l) { groups[l.k] = L.featureGroup().addTo(map); });
    function popup(s, l, extra) {
      return "<strong>" + esc(l.label) + ":</strong> " + esc(s.n) + "<br>" + esc(s.c) + " · <strong>" + VL[s.v] + "</strong>" + (extra || "") +
        '<br><a href="#' + esc(s.id) + '">Details and sources</a>';
    }
    L.geoJSON(areas, {
      style: function (f) { var s = byId[f.properties.id] || {}; return { color: s.v === "unverified" ? "#a16207" : "#b91c1c", weight: s.v === "unverified" ? 2 : 1, dashArray: s.v === "unverified" ? "6 4" : null, fillColor: "#fca5a5", fillOpacity: 0.3 }; },
      onEachFeature: function (f, ly) { var s = byId[f.properties.id]; if (s) ly.bindPopup(popup(s, LAYERS[0], "<br>" + (s.km != null ? esc(s.km) + " km² · " : "") + esc(s.cl) + "<br><em>Shaded area is the whole province or country containing reported hazards, not a minefield outline.</em>")); }
    }).eachLayer(function (ly) { groups.uxo.addLayer(ly); });
    d.sites.forEach(function (s) {
      if (s.L === "uxo" || s.la == null) return;
      var l = LAYERS.filter(function (x) { return x.k === s.L; })[0], un = s.v === "unverified";
      var note = s.L === "mil" ? "<br><em>Airfield location, not the base compound; may be off by 2–5 km.</em>" : "";
      L.circleMarker([s.la, s.lo], { radius: 7, color: un ? "#a16207" : l.col, weight: un ? 3 : 2, dashArray: un ? "3 3" : null, fillColor: l.fill, fillOpacity: 0.9 })
        .bindPopup(popup(s, l, note)).addTo(groups[s.L]);
    });
    var f = document.getElementById("afr-filters");
    if (f) {
      f.innerHTML = LAYERS.map(function (l) {
        var n = l.k === "uxo" ? areas.features.length : d.sites.filter(function (s) { return s.L === l.k && s.la != null; }).length;
        return '<label class="env-check"><input type="checkbox" data-k="' + l.k + '" checked> <i class="env-dot" style="border-color:' + l.col + ';background:' + l.fill + '" aria-hidden="true"></i> ' + esc(l.label) + " (" + n + ")</label>";
      }).join("") + '<span class="env-check"><i class="env-dot" style="border:2px dashed #a16207;background:#fff" aria-hidden="true"></i> Unverified</span>';
      Array.prototype.forEach.call(f.querySelectorAll("input"), function (cb) {
        cb.addEventListener("change", function () { var g = groups[cb.getAttribute("data-k")]; if (cb.checked) g.addTo(map); else map.removeLayer(g); });
      });
    }
  });
})();
