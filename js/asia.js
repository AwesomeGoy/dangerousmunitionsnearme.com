/* Asia section map. Leaflet with OpenStreetMap tiles, like the Middle East page; no tracking beyond the site's GA4 tag. */
(function () {
  "use strict";
  var script = document.currentScript, base = script.getAttribute("data-base") || "";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function load(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }
  var LAYERS = [
    { k: "area", label: "Landmine / UXO country stand-in (not a hazard footprint)", col: "#b91c1c", fill: "#fca5a5" },
    { k: "mil", label: "U.S. military (airfield-level)", col: "#1e3a8a", fill: "#93c5fd" },
    { k: "min", label: "Mine (USGS MRDS point)", col: "#3f6212", fill: "#bef264" }
  ];
  var VL = { verified: (window.DMNM_I18N ? DMNM_I18N.t("status.verified", "Verified") : "Verified"), corrected: (window.DMNM_I18N ? DMNM_I18N.t("status.corrected", "Corrected") : "Corrected"), unverified: (window.DMNM_I18N ? DMNM_I18N.t("status.unverified", "Unverified") : "Unverified") };
  var AREA_NOTE = "Shaded area is a whole-country outline standing in for reported landmine or UXO contamination somewhere inside it. It is not a hazard footprint, and the outline is not a statement on borders.";
  Promise.all([load(base + "data/asia.json"), load(base + "data/asia-areas.json")]).then(function (r) {
    var d = r[0], areas = r[1], byId = {};
    d.sites.forEach(function (s) { byId[s.id] = s; });
    var el = document.getElementById("map"); if (!el || typeof L === "undefined") return;
    var map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(map);
    var groups = {}; LAYERS.forEach(function (l) { groups[l.k] = L.featureGroup().addTo(map); });
    function popup(s, l, extra) {
      return "<strong>" + esc(l.label.split(" (")[0]) + ":</strong> " + esc(s.n) + "<br>" + esc(s.c) + " · <strong>" + VL[s.v] + "</strong>" + (extra || "") +
        '<br><a href="#' + esc(s.id) + '">Details and sources</a>';
    }
    L.geoJSON(areas, {
      style: function (f) { var s = byId[f.properties.id], un = s && s.v === "unverified"; return { color: un ? "#a16207" : "#b91c1c", weight: 1, dashArray: "4 3", fillColor: "#fca5a5", fillOpacity: 0.22 }; },
      onEachFeature: function (f, ly) { var s = byId[f.properties.id]; if (s) ly.bindPopup(popup(s, LAYERS[0], "<br><em>" + AREA_NOTE + "</em>")); }
    }).eachLayer(function (ly) { groups.area.addLayer(ly); });
    var pts = [];
    d.sites.forEach(function (s) {
      if (s.la == null) return;
      var l = LAYERS.filter(function (x) { return x.k === s.L; })[0]; if (!l) return;
      var un = s.v === "unverified", note = "";
      if (s.L === "mil") note = s.id === "as-mil-sasebo" ? "<br><em>City-level weather-station location, not the base.</em>" : "<br><em>Airfield weather-station location, not the base outline.</em>";
      if (s.L === "min") note = "<br><em>USGS MRDS record point (precision not stated).</em>";
      pts.push([s.la, s.lo]);
      L.circleMarker([s.la, s.lo], { radius: 7, color: un ? "#a16207" : l.col, weight: un ? 3 : 2, dashArray: un ? "3 3" : null, fillColor: l.fill, fillOpacity: 0.9 })
        .bindPopup(popup(s, l, note)).addTo(groups[s.L]);
    });
    map.fitBounds(L.latLngBounds(pts).extend(groups.area.getBounds()).pad(0.02));
    var f = document.getElementById("afr-filters");
    if (f) {
      f.innerHTML = LAYERS.map(function (l) {
        var n = l.k === "area" ? areas.features.length : d.sites.filter(function (s) { return s.L === l.k && s.la != null; }).length;
        return '<label class="env-check"><input type="checkbox" data-k="' + l.k + '" checked> <i class="env-dot" style="border-color:' + l.col + ';background:' + l.fill + '" aria-hidden="true"></i> ' + esc(l.label) + " (" + n + ")</label>";
      }).join("") + '<span class="env-check"><i class="env-dot" style="border:2px dashed #a16207;background:#fff" aria-hidden="true"></i> Unverified</span>';
      Array.prototype.forEach.call(f.querySelectorAll("input"), function (cb) {
        cb.addEventListener("change", function () { var g = groups[cb.getAttribute("data-k")]; if (cb.checked) g.addTo(map); else map.removeLayer(g); });
      });
    }
  });
})();
