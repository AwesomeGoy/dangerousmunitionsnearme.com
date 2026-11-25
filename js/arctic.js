/* Arctic section map: north polar stereographic (EPSG:3413) drawn in Leaflet CRS.Simple from self-hosted Natural Earth land (km). No web tiles. */
(function () {
  "use strict";
  var script = document.currentScript, base = script.getAttribute("data-base") || "";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var LAYERS = [
    { k: "mil", label: "Military base or radar site", col: "#1e3a8a", fill: "#93c5fd" },
    { k: "nuc", label: "Nuclear test, accident or dumped reactor", col: "#6b21a8", fill: "#e9d5ff" },
    { k: "haz", label: "Contamination, waste or explosion", col: "#7c2d12", fill: "#fb923c" },
    { k: "min", label: "Mine, smelter or spill", col: "#14532d", fill: "#86efac" }
  ];
  var VL = { verified: "Verified", corrected: "Corrected", unverified: "Unverified" };
  fetch(base + "data/arctic.json").then(function (r) { return r.json(); }).then(function (d) {
    var el = document.getElementById("map"); if (!el || typeof L === "undefined") return;
    var map = L.map(el, { crs: L.CRS.Simple, minZoom: -6, maxZoom: 4, zoomSnap: 0.25, scrollWheelZoom: false, zoomControl: false, attributionControl: true, maxBounds: [[-5200, -5200], [5200, 5200]] });
    L.control.zoom({ position: "topright" }).addTo(map);
    map.attributionControl.setPrefix(false).addAttribution("Land: Natural Earth 1:50m · polar stereographic EPSG:3413");
    L.polygon(d.base.land, { color: "#475569", weight: 0.6, fillColor: "#cbd5e1", fillOpacity: 1, interactive: false }).addTo(map);
    d.base.circles.forEach(function (c) {
      L.polyline(c.pts, { color: "#64748b", weight: 0.7, dashArray: "3 4", interactive: false }).addTo(map);
      L.marker(c.pts[105], { icon: L.divIcon({ className: "ant-lbl", html: c.lat + "°N", iconSize: [40, 14] }), interactive: false, keyboard: false }).addTo(map);
    });
    L.polyline(d.base.ac, { color: "#b91c1c", weight: 1.2, dashArray: "6 5", interactive: false }).addTo(map);
    L.marker(d.base.ac[22], { icon: L.divIcon({ className: "ant-lbl ant-lbl--ac", html: "Arctic Circle", iconSize: [80, 14] }), interactive: false, keyboard: false }).addTo(map);
    d.base.meridians.forEach(function (m) {
      L.polyline(m.pts, { color: "#64748b", weight: 0.7, dashArray: "3 4", interactive: false }).addTo(map);
      if (m.lon % 90 === 0) {
        var t = m.lon === 0 ? "0°" : m.lon === -180 ? "180°" : (Math.abs(m.lon) + "°" + (m.lon > 0 ? "E" : "W"));
        L.marker(m.pts[0], { icon: L.divIcon({ className: "ant-lbl", html: t, iconSize: [40, 14] }), interactive: false, keyboard: false }).addTo(map);
      }
    });
    L.marker([0, 0], { icon: L.divIcon({ className: "ant-lbl", html: "North Pole", iconSize: [70, 14], iconAnchor: [-6, 18] }), interactive: false, keyboard: false }).addTo(map);
    var pts = d.sites.filter(function (s) { return s.px != null; }).map(function (s) { return [s.py, s.px]; });
    map.fitBounds(L.latLngBounds(pts).pad(0.05), { paddingTopLeft: [12, 12], paddingBottomRight: [12, 22] });
    var groups = {}; LAYERS.forEach(function (l) { groups[l.k] = L.featureGroup().addTo(map); });
    var byLoc = {};
    d.sites.forEach(function (s) { if (s.px == null) return; var k = s.px + "," + s.py + "," + s.L; (byLoc[k] = byLoc[k] || []).push(s); });
    Object.keys(byLoc).forEach(function (k) {
      var ss = byLoc[k], s0 = ss[0], l = LAYERS.filter(function (x) { return x.k === s0.L; })[0];
      var un = ss.some(function (s) { return s.v === "unverified"; });
      var html = ss.map(function (s) {
        var note = s.fl ? "<br><em>Flagged: just outside the boundary data; checked and kept.</em>" : "";
        if (s.v === "unverified" && s.L === "mil") note += "<br><em>Point is a weather or airfield station; role not confirmed.</em>";
        return "<strong>" + esc(l.label) + ":</strong> " + esc(s.n) + "<br><strong>" + VL[s.v] + "</strong>" + note + '<br><a href="#' + esc(s.id) + '">Details and sources</a>';
      }).join("<hr>");
      L.circleMarker([s0.py, s0.px], { radius: 7, color: un ? "#a16207" : l.col, weight: un ? 3 : 2, dashArray: un ? "3 3" : null, fillColor: l.fill, fillOpacity: 0.9 })
        .bindPopup(html).addTo(groups[s0.L]);
    });
    var f = document.getElementById("afr-filters");
    if (f) {
      f.innerHTML = LAYERS.map(function (l) {
        var n = d.sites.filter(function (s) { return s.L === l.k && s.px != null; }).length;
        return '<label class="env-check"><input type="checkbox" data-k="' + l.k + '" checked> <i class="env-dot" style="border-color:' + l.col + ';background:' + l.fill + '" aria-hidden="true"></i> ' + esc(l.label) + " (" + n + ")</label>";
      }).join("") + '<span class="env-check"><i class="env-dot" style="border:2px solid #475569;background:#cbd5e1" aria-hidden="true"></i> Land</span><span class="env-check"><i class="env-dot" style="border:2px dashed #a16207;background:#fff" aria-hidden="true"></i> Unverified</span>';
      Array.prototype.forEach.call(f.querySelectorAll("input"), function (cb) {
        cb.addEventListener("change", function () { var g = groups[cb.getAttribute("data-k")]; if (cb.checked) g.addTo(map); else map.removeLayer(g); });
      });
    }
  });
})();
