/* Petroleum layer map. Leaflet with OpenStreetMap tiles; no tracking beyond the site's GA4 tag. */
(function () {
  "use strict";
  var script = document.currentScript, base = script.getAttribute("data-base") || "";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var LAYERS = [
    { k: "ex", label: "Explosion or fire", col: "#b91c1c", fill: "#fca5a5" },
    { k: "sp", label: "Major oil spill", col: "#1e3a8a", fill: "#93c5fd" },
    { k: "co", label: "Long-running contamination", col: "#78350f", fill: "#fcd34d" }
  ];
  var VL = { verified: (window.DMNM_I18N ? DMNM_I18N.t("status.verified", "Verified") : "Verified"), corrected: (window.DMNM_I18N ? DMNM_I18N.t("status.corrected", "Corrected") : "Corrected"), unverified: (window.DMNM_I18N ? DMNM_I18N.t("status.unverified", "Unverified") : "Unverified") };
  fetch(base + "data/petroleum.json").then(function (r) { return r.json(); }).then(function (d) {
    var el = document.getElementById("map"); if (!el || typeof L === "undefined") return;
    var map = L.map(el, { scrollWheelZoom: false, worldCopyJump: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(map);
    var groups = {}; LAYERS.forEach(function (l) { groups[l.k] = L.featureGroup().addTo(map); });
    var pts = [];
    d.sites.forEach(function (s) {
      if (s.la == null) return;
      var l = LAYERS.filter(function (x) { return x.k === s.L; })[0]; if (!l) return;
      var un = s.v === "unverified", reg = s.id === "pet-sp-gulf-war-1991", note = "";
      if (reg) note = "<br><em>Regional marker, not a site: marks the region of the 1991 releases.</em>";
      else if (s.id === "pet-co-kirtland-bff") note = "<br><em>Point marks the air base, not the Bulk Fuels Facility.</em>";
      else if (s.npl) note = "<br><em>EPA Superfund listing data only.</em>";
      else if (s.cs && s.cs.indexOf("NOAA") === 0) note = "<br><em>NOAA incident point; often approximate.</em>";
      pts.push([s.la, s.lo]);
      L.circleMarker([s.la, s.lo], { radius: reg ? 11 : 7, color: un ? "#a16207" : l.col, weight: un || reg ? 3 : 2, dashArray: un ? "3 3" : (reg ? "5 4" : null), fillColor: l.fill, fillOpacity: reg ? 0.35 : 0.9 })
        .bindPopup("<strong>" + esc(l.label) + ":</strong> " + esc(s.n) + "<br>" + esc(s.c) + " · <strong>" + VL[s.v] + "</strong>" + note + '<br><a href="#' + esc(s.id) + '">Details and sources</a>')
        .addTo(groups[s.L]);
    });
    map.fitBounds(L.latLngBounds(pts).pad(0.05));
    var f = document.getElementById("afr-filters");
    if (f) {
      f.innerHTML = LAYERS.map(function (l) {
        var n = d.sites.filter(function (s) { return s.L === l.k && s.la != null; }).length;
        return '<label class="env-check"><input type="checkbox" data-k="' + l.k + '" checked> <i class="env-dot" style="border-color:' + l.col + ';background:' + l.fill + '" aria-hidden="true"></i> ' + esc(l.label) + " (" + n + ")</label>";
      }).join("") + '<span class="env-check"><i class="env-dot" style="border:2px dashed #a16207;background:#fff" aria-hidden="true"></i> Unverified</span>';
      Array.prototype.forEach.call(f.querySelectorAll("input"), function (cb) {
        cb.addEventListener("change", function () { var g = groups[cb.getAttribute("data-k")]; if (cb.checked) g.addTo(map); else map.removeLayer(g); });
      });
    }
  });
})();
