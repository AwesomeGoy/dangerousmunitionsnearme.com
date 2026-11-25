/* Small Leaflet maps for regional sections: <div class="rg-map" data-points='[{"id","n","la","lo","v"}]'> */
(function () {
  if (typeof L === "undefined") return;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  document.querySelectorAll(".rg-map[data-points]").forEach(function (el) {
    var pts = JSON.parse(el.getAttribute("data-points") || "[]");
    if (!pts.length) return;
    var m = L.map(el, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 18 }).addTo(m);
    var b = [];
    pts.forEach(function (p) {
      var u = p.v === "unverified";
      L.circleMarker([p.la, p.lo], { radius: 8, color: u ? "#a16207" : "#1e3a8a", weight: 2, dashArray: u ? "4 3" : null, fillColor: u ? "#fde68a" : "#3b82f6", fillOpacity: 0.7 })
        .bindPopup("<strong>" + esc(p.n) + "</strong><br><a href=\"#" + esc(p.id) + "\">Read the record</a>").addTo(m);
      b.push([p.la, p.lo]);
    });
    if (b.length > 1) m.fitBounds(b, { padding: [40, 40], maxZoom: 6 }); else m.setView(b[0], 6);
  });
})();
