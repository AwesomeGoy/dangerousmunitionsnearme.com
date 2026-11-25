/* Antarctica section map: south polar stereographic (EPSG:3031) drawn in Leaflet CRS.Simple from a self-hosted coastline (km). No web tiles. */
(function () {
  "use strict";
  var script = document.currentScript, base = script.getAttribute("data-base") || "";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var LAYERS = [
    { k: "mil", label: "Military / government station", col: "#1e3a8a", fill: "#93c5fd" },
    { k: "nuc", label: "Nuclear reactor or RTG site", col: "#6b21a8", fill: "#e9d5ff" },
    { k: "haz", label: "Contamination, waste or explosives", col: "#7c2d12", fill: "#fb923c" }
  ];
  var VL = { verified: "Verified", corrected: "Corrected", unverified: "Unverified" };
  fetch(base + "data/antarctica.json").then(function (r) { return r.json(); }).then(function (d) {
    var el = document.getElementById("map"); if (!el || typeof L === "undefined") return;
    var map = L.map(el, { crs: L.CRS.Simple, minZoom: -4, maxZoom: 4, zoomSnap: 0.25, scrollWheelZoom: false, attributionControl: true, maxBounds: [[-4300, -4300], [4300, 4300]] });
    map.attributionControl.setPrefix(false).addAttribution("Coastline: SCAR ADD v7.13 (BAS) · polar stereographic EPSG:3031");
    L.polygon(d.base.shelf, { color: "#94a3b8", weight: 0.6, fillColor: "#f1f5f9", fillOpacity: 1, interactive: false }).addTo(map);
    L.polygon(d.base.land, { color: "#475569", weight: 0.6, fillColor: "#cbd5e1", fillOpacity: 1, interactive: false }).addTo(map);
    d.base.circles.forEach(function (c) {
      L.polyline(c.pts, { color: "#64748b", weight: 0.7, dashArray: "3 4", interactive: false }).addTo(map);
      L.marker(c.pts[60], { icon: L.divIcon({ className: "ant-lbl", html: Math.abs(c.lat) + "°S", iconSize: [40, 14] }), interactive: false, keyboard: false }).addTo(map);
    });
    d.base.meridians.forEach(function (m) {
      L.polyline(m.pts, { color: "#64748b", weight: 0.7, dashArray: "3 4", interactive: false }).addTo(map);
      if (m.lon % 90 === 0) {
        var t = m.lon === 0 ? "0°" : m.lon === -180 ? "180°" : (Math.abs(m.lon) + "°" + (m.lon > 0 ? "E" : "W"));
        L.marker(m.pts[1], { icon: L.divIcon({ className: "ant-lbl", html: t, iconSize: [40, 14] }), interactive: false, keyboard: false }).addTo(map);
      }
    });
    L.marker([0, 0], { icon: L.divIcon({ className: "ant-lbl", html: "South Pole", iconSize: [70, 14], iconAnchor: [-6, 18] }), interactive: false, keyboard: false }).addTo(map);
    map.fitBounds([[-2700, -2900], [2400, 2900]]);
    var groups = {}; LAYERS.forEach(function (l) { groups[l.k] = L.featureGroup().addTo(map); });
    var byLoc = {};
    d.sites.forEach(function (s) { if (s.px == null) return; var k = s.px + "," + s.py + "," + s.L; (byLoc[k] = byLoc[k] || []).push(s); });
    Object.keys(byLoc).forEach(function (k) {
      var ss = byLoc[k], s0 = ss[0], l = LAYERS.filter(function (x) { return x.k === s0.L; })[0];
      var un = ss.some(function (s) { return s.v === "unverified"; });
      var html = ss.map(function (s) {
        var note = s.sl ? "<br><em>Mapped at the station, not the exact site.</em>" : (s.cn ? "<br><em>Just off the simplified coastline (small island or spit).</em>" : "");
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
      }).join("") + '<span class="env-check"><i class="env-dot" style="border:2px solid #475569;background:#cbd5e1" aria-hidden="true"></i> Land</span><span class="env-check"><i class="env-dot" style="border:2px solid #94a3b8;background:#f1f5f9" aria-hidden="true"></i> Ice shelf</span>';
      Array.prototype.forEach.call(f.querySelectorAll("input"), function (cb) {
        cb.addEventListener("change", function () { var g = groups[cb.getAttribute("data-k")]; if (cb.checked) g.addTo(map); else map.removeLayer(g); });
      });
    }
  });
})();
