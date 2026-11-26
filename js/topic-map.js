/* Topic page map (shared by all topic pages). Leaflet with OpenStreetMap tiles; no tracking beyond the site's GA4 tag. */
(function () {
  "use strict";
  var script = document.currentScript, base = script.getAttribute("data-base") || "", src = script.getAttribute("data-src");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var VL = { verified: (window.DMNM_I18N ? DMNM_I18N.t("status.verified", "Verified") : "Verified"), corrected: (window.DMNM_I18N ? DMNM_I18N.t("status.corrected", "Corrected") : "Corrected"), unverified: (window.DMNM_I18N ? DMNM_I18N.t("status.unverified", "Unverified") : "Unverified") }, UNV = "#a16207";
  fetch(base + src).then(function (r) { return r.json(); }).then(function (d) {
    var el = document.getElementById("map"); if (!el || typeof L === "undefined") return;
    var LAYERS = d.meta.layers, byId = {}, hasAreas = d.areas && d.areas.features.length;
    d.sites.forEach(function (s) { byId[s.id] = s; });
    var map = L.map(el, { scrollWheelZoom: false, worldCopyJump: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(map);
    var groups = {}; LAYERS.forEach(function (l) { groups[l.k] = L.featureGroup().addTo(map); });
    if (hasAreas) groups.area = L.featureGroup().addTo(map);
    function lay(k) { return LAYERS.filter(function (x) { return x.k === k; })[0] || LAYERS[0]; }
    function popup(s, l, note) {
      return "<strong>" + esc(l.label) + ":</strong> " + esc(s.n) + "<br>" + esc(s.c) + " · <strong>" + VL[s.v] + "</strong>" +
        (note ? "<br><em>" + esc(note) + "</em>" : "") + '<br><a href="#' + esc(s.id) + '">Details and sources</a>';
    }
    var bounds = L.latLngBounds([]);
    if (hasAreas) {
      L.geoJSON(d.areas, {
        style: function (f) { var s = byId[f.properties.id], l = lay(s ? s.L : null), un = s && s.v === "unverified";
          return { color: un ? UNV : l.col, weight: 2, dashArray: un ? "4 3" : null, fillColor: l.fill, fillOpacity: 0.3 }; },
        onEachFeature: function (f, ly) { var s = byId[f.properties.id]; if (s) ly.bindPopup(popup(s, lay(s.L), f.properties.note)); }
      }).eachLayer(function (ly) { groups.area.addLayer(ly); });
      bounds.extend(groups.area.getBounds());
    }
    d.sites.forEach(function (s) {
      if (s.la == null) return;
      var l = lay(s.L), un = s.v === "unverified";
      bounds.extend([s.la, s.lo]);
      L.circleMarker([s.la, s.lo], { radius: 7, color: un ? UNV : l.col, weight: un ? 3 : 2, dashArray: un ? "3 3" : null, fillColor: l.fill, fillOpacity: 0.9 })
        .bindPopup(popup(s, l, s.pn)).addTo(groups[s.L]);
    });
    if (bounds.isValid()) map.fitBounds(bounds.pad(0.08), { maxZoom: 10 }); else map.setView([20, 0], 2);
    var f = document.getElementById("afr-filters");
    if (f) {
      var opts = LAYERS.map(function (l) { return { k: l.k, label: l.label, col: l.col, fill: l.fill, n: d.sites.filter(function (s) { return s.L === l.k && s.la != null; }).length }; })
        .filter(function (o) { return o.n > 0; });
      if (hasAreas) opts.push({ k: "area", label: "Official outlines", col: "#374151", fill: "#e5e7eb", n: d.areas.features.length });
      f.innerHTML = opts.map(function (o) {
        return '<label class="env-check"><input type="checkbox" data-k="' + o.k + '" checked> <i class="env-dot" style="border-color:' + o.col + ';background:' + o.fill + '" aria-hidden="true"></i> ' + esc(o.label) + " (" + o.n + ")</label>";
      }).join("") + '<span class="env-check"><i class="env-dot" style="border:2px dashed ' + UNV + ';background:#fff" aria-hidden="true"></i> Unverified</span>';
      Array.prototype.forEach.call(f.querySelectorAll("input"), function (cb) {
        cb.addEventListener("change", function () { var g = groups[cb.getAttribute("data-k")]; if (cb.checked) g.addTo(map); else map.removeLayer(g); });
      });
    }
  });
})();
