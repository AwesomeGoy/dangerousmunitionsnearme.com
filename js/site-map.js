
(function () {
  var el = document.getElementById("map");
  if (!el || typeof L === "undefined") return;
  var lat = parseFloat(el.getAttribute("data-lat"));
  var lon = parseFloat(el.getAttribute("data-lon"));
  var name = el.getAttribute("data-name") || "Site";
  var layerSrc = el.getAttribute("data-layers");
  if (!isFinite(lat) || !isFinite(lon)) return;

  var map = L.map(el).setView([lat, lon], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(map);
  if (L.Icon && L.Icon.Default) {
    L.Icon.Default.imagePath = el.getAttribute("data-icon-path") || "../lib/leaflet/images/";
  }
  L.circleMarker([lat, lon], {
    radius: 10, color: "#1c1917", weight: 1, fillColor: "#b45309", fillOpacity: 0.9
  }).addTo(map).bindPopup(name);

  var circle = L.circle([lat, lon], {
    radius: 16093.4,
    color: "#9a3412",
    weight: 1,
    fill: false,
    dashArray: "4 4"
  });

  var schoolLayer = L.layerGroup();
  var waterLayer = L.layerGroup();
  circle.addTo(map);

  function milesLabel(n) {
    if (n == null || n === "") return "";
    return " · " + n + " mi";
  }

  function addLayers(data) {
    (data.schools || []).forEach(function (s) {
      L.circleMarker([s.lat, s.lon], {
        radius: 6, color: "#1e3a8a", weight: 1, fillColor: "#1d4ed8", fillOpacity: 0.9
      }).bindPopup(
        "<strong>" + (s.name || "School") + "</strong>" +
        (s.city ? "<br>" + s.city + ", " + (s.state || "") : "") +
        milesLabel(s.miles)
      ).addTo(schoolLayer);
    });
    function addGeom(obj, color) {
      if (!obj || !obj.geometry) return;
      L.geoJSON(obj.geometry, {
        style: function () {
          return { color: color, weight: 2, fillColor: "#7dd3fc", fillOpacity: 0.25 };
        }
      }).bindPopup(
        (obj.name || "Water feature") + milesLabel(obj.miles)
      ).addTo(waterLayer);
    }
    (data.waterways || []).forEach(function (w) { addGeom(w, "#0369a1"); });
    (data.waterbodies || []).forEach(function (w) { addGeom(w, "#0284c7"); });
    schoolLayer.addTo(map);
    waterLayer.addTo(map);
    var note = document.getElementById("layer-counts");
    if (note) {
      note.textContent =
        (data.school_count || (data.schools || []).length) + " public schools and " +
        ((data.waterway_count || (data.waterways || []).length) + (data.waterbody_count || (data.waterbodies || []).length)) +
        " surface-water features within about 10 miles are in this extract. Public water wells are not mapped.";
    }
  }

  if (layerSrc) {
    fetch(layerSrc)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (data) addLayers(data); })
      .catch(function () {
        var note = document.getElementById("layer-counts");
        if (note) note.textContent = "Nearby school and water layers could not be loaded in this browser session.";
      });
  }

  function bindToggle(id, layer) {
    var box = document.getElementById(id);
    if (!box) return;
    box.addEventListener("change", function () {
      if (box.checked) map.addLayer(layer);
      else map.removeLayer(layer);
    });
  }
  bindToggle("layer-schools", schoolLayer);
  bindToggle("layer-water", waterLayer);
  bindToggle("layer-radius", circle);
})();
