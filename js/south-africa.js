/* South Africa page map. Leaflet with OpenStreetMap tiles, like the Africa page; no tracking beyond the site's GA4 tag. */
(function () {
  "use strict";
  var script = document.currentScript, base = script.getAttribute("data-base") || "";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var LAYERS = [
    { k: "mil", label: "Military base or test range", col: "#1e3a8a", fill: "#93c5fd" },
    { k: "nuc", label: "Nuclear reactor, power station or waste site", col: "#6b21a8", fill: "#e9d5ff" },
    { k: "min", label: "Mine (USGS 2018)", col: "#3f6212", fill: "#bef264" }
  ];
  var VL = { verified: "Verified", corrected: "Corrected", unverified: "Unverified" };
  fetch(base + "data/south-africa.json").then(function (r) { return r.json(); }).then(function (d) {
    var el = document.getElementById("map"); if (!el || typeof L === "undefined") return;
    var map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(map);
    var groups = {}; LAYERS.forEach(function (l) { groups[l.k] = L.featureGroup().addTo(map); });
    var pts = [];
    d.sites.forEach(function (s) {
      if (s.py == null) return;
      var l = LAYERS.filter(function (x) { return x.k === s.L; })[0]; if (!l) return;
      var un = s.v === "unverified", note = "";
      if (s.cp && s.cp.indexOf("airfield-level") === 0) note = "<br><em>Mapped at the airfield weather station.</em>";
      if (s.id === "zaf-nuc-safari-1") note = "<br><em>Site-area sample point, not the reactor building.</em>";
      if (s.est) note = "<br><em>USGS estimated location.</em>";
      if (un) note += "<br><em>Units not confirmed in an official source.</em>";
      pts.push([s.py, s.px]);
      L.circleMarker([s.py, s.px], { radius: 7, color: un ? "#a16207" : l.col, weight: un ? 3 : 2, dashArray: un ? "3 3" : null, fillColor: l.fill, fillOpacity: 0.9 })
        .bindPopup("<strong>" + esc(l.label) + ":</strong> " + esc(s.n) + "<br><strong>" + VL[s.v] + "</strong>" + note + '<br><a href="#' + esc(s.id) + '">Details and sources</a>')
        .addTo(groups[s.L]);
    });
    map.fitBounds(L.latLngBounds(pts).pad(0.08));
    var f = document.getElementById("afr-filters");
    if (f) {
      f.innerHTML = LAYERS.map(function (l) {
        var n = d.sites.filter(function (s) { return s.L === l.k && s.py != null; }).length;
        return '<label class="env-check"><input type="checkbox" data-k="' + l.k + '" checked> <i class="env-dot" style="border-color:' + l.col + ';background:' + l.fill + '" aria-hidden="true"></i> ' + esc(l.label) + " (" + n + ")</label>";
      }).join("") + '<span class="env-check"><i class="env-dot" style="border:2px dashed #a16207;background:#fff" aria-hidden="true"></i> Unverified</span>';
      Array.prototype.forEach.call(f.querySelectorAll("input"), function (cb) {
        cb.addEventListener("change", function () { var g = groups[cb.getAttribute("data-k")]; if (cb.checked) g.addTo(map); else map.removeLayer(g); });
      });
    }
  });
})();
