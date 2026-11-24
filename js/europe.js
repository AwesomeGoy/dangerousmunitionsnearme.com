/* Europe sea-dump map, filters, and paginated table.
 * Loads a compact JSON copy; does not send searches to a server.
 */
(function () {
  "use strict";

  var DATA_SRC = "../data/europe-compact.json";
  var GEOMS_SRC = "../data/europe-geoms.json";
  var PAGE_SIZE = 50;
  var TYPE_LABELS = {
    c: "Conventional",
    h: "Chemical",
    u: "Unknown",
    m: "Chemical and conventional",
  };
  var TYPE_COLORS = { c: "#1d4ed8", h: "#9a3412", u: "#57534e", m: "#7c3aed" };
  var UNASSIGNED = "unassigned";
  var UNASSIGNED_LABEL = "High seas / shared waters";

  var state = {
    meta: {},
    rows: [],
    filtered: [],
    geoms: null,
    geomsTried: false,
    country: "",
    type: "",
    kind: "",
    query: "",
    page: 1,
    sortKey: "country",
    sortDir: 1,
    map: null,
    cluster: null,
    areas: null,
    showAreas: true,
    canvas: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function unpack(a) {
    var flags = a[5] || 0;
    return {
      id: a[0],
      country: a[1] || "",
      type: a[2],
      lat: a[3],
      lon: a[4],
      area: !!(flags & 1),
      hasGeom: !!(flags & 2),
      ospar: !!a[6],
      desc: a[7] || "",
      year: a[8] || "",
      region: a[9] || "",
    };
  }

  function countryLabel(code, names) {
    if (!code) return UNASSIGNED_LABEL;
    return (names && names[code]) || code;
  }

  function typeLabel(code) {
    return TYPE_LABELS[code] || code;
  }

  function typeClass(code) {
    if (code === "h") return "chemical";
    if (code === "c") return "conventional";
    if (code === "m") return "mixed";
    return "unknown";
  }

  function kindLabel(row) {
    if (!row.area) return "Point";
    return row.hasGeom ? "Area (centroid + outline)" : "Area centroid";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function matches(row) {
    if (state.country) {
      if (state.country === UNASSIGNED) {
        if (row.country) return false;
      } else if (row.country !== state.country) {
        return false;
      }
    }
    if (state.type && row.type !== state.type) return false;
    if (state.kind === "point" && row.area) return false;
    if (state.kind === "area" && !row.area) return false;
    if (state.query) {
      var q = state.query;
      var hay = (
        row.id +
        " " +
        countryLabel(row.country, state.meta.countries) +
        " " +
        typeLabel(row.type) +
        " " +
        row.desc +
        " " +
        (row.region || "") +
        " " +
        (row.year || "")
      ).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function sortRows(rows) {
    var key = state.sortKey;
    var dir = state.sortDir;
    var names = state.meta.countries || {};
    rows.sort(function (a, b) {
      var av, bv;
      if (key === "country") {
        av = countryLabel(a.country, names).toLowerCase();
        bv = countryLabel(b.country, names).toLowerCase();
      } else if (key === "type") {
        av = typeLabel(a.type);
        bv = typeLabel(b.type);
      } else if (key === "kind") {
        av = a.area ? 1 : 0;
        bv = b.area ? 1 : 0;
      } else if (key === "year") {
        av = a.year || 0;
        bv = b.year || 0;
      } else if (key === "id") {
        av = a.id;
        bv = b.id;
      } else {
        av = (a.desc || "").toLowerCase();
        bv = (b.desc || "").toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  function applyFilters() {
    state.filtered = state.rows.filter(matches);
    sortRows(state.filtered);
    var maxPage = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE) || 1);
    if (state.page > maxPage) state.page = maxPage;
    if (state.page < 1) state.page = 1;
    renderCount();
    renderTable();
    refreshMap();
  }

  function renderCount() {
    var el = $("europe-count");
    if (!el) return;
    var n = state.filtered.length;
    var total = state.rows.length;
    var start = n === 0 ? 0 : (state.page - 1) * PAGE_SIZE + 1;
    var end = Math.min(n, state.page * PAGE_SIZE);
    var extra = "";
    if (n !== total) extra = " (filtered from " + total.toLocaleString("en-US") + ")";
    if (n === 0) {
      el.textContent = "No records match those filters" + extra + ".";
    } else {
      el.textContent =
        "Showing " +
        start.toLocaleString("en-US") +
        "–" +
        end.toLocaleString("en-US") +
        " of " +
        n.toLocaleString("en-US") +
        " records" +
        extra +
        ".";
    }
    var empty = $("europe-empty");
    if (empty) empty.hidden = n !== 0;
  }

  function renderTable() {
    var tbody = document.querySelector("#europe-table tbody");
    if (!tbody) return;
    var n = state.filtered.length;
    var start = (state.page - 1) * PAGE_SIZE;
    var pageRows = state.filtered.slice(start, start + PAGE_SIZE);
    var names = state.meta.countries || {};
    var html = [];
    for (var i = 0; i < pageRows.length; i++) {
      var r = pageRows[i];
      var tc = typeClass(r.type);
      html.push("<tr>");
      html.push("<td>" + escapeHtml(r.id) + "</td>");
      html.push(
        '<td><span class="type-pill ' +
          tc +
          '">' +
          escapeHtml(typeLabel(r.type)) +
          "</span></td>"
      );
      html.push("<td>" + escapeHtml(countryLabel(r.country, names)) + "</td>");
      html.push('<td><span class="kind-pill">' + escapeHtml(kindLabel(r)) + "</span>");
      if (r.ospar) {
        html.push(' <span class="ospar-flag">OSPAR encounter</span>');
      }
      html.push("</td>");
      html.push('<td class="desc">' + escapeHtml(r.desc) + "</td>");
      html.push("<td>" + (r.year ? escapeHtml(String(r.year)) : "—") + "</td>");
      html.push("</tr>");
    }
    tbody.innerHTML = html.join("");

    var prev = $("europe-prev");
    var next = $("europe-next");
    var pageLab = $("europe-page-label");
    var maxPage = Math.max(1, Math.ceil(n / PAGE_SIZE) || 1);
    if (prev) prev.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= maxPage;
    var prevB = $("europe-prev-bottom");
    var nextB = $("europe-next-bottom");
    if (prevB) prevB.disabled = state.page <= 1;
    if (nextB) nextB.disabled = state.page >= maxPage;
    if (pageLab) pageLab.textContent = "Page " + state.page + " of " + maxPage;
  }

  function popupHtml(row) {
    var names = state.meta.countries || {};
    var bits = [];
    bits.push("<div class=\"europe-popup\">");
    bits.push("<h3>" + escapeHtml(typeLabel(row.type)) + "</h3>");
    bits.push("<p>" + escapeHtml(countryLabel(row.country, names)));
    if (row.region) bits.push(" · " + escapeHtml(row.region));
    bits.push("</p>");
    if (row.ospar) {
      bits.push(
        '<p class="warn">OSPAR encounter record — not a designated dump site.</p>'
      );
    }
    if (row.area) {
      bits.push(
        '<p class="muted">This pin is an area centroid' +
          (row.hasGeom
            ? ", with the official polygon drawn on the map when outlines are on."
            : ". The official polygon was too large to keep in this page copy, so only the centroid is shown.") +
          "</p>"
      );
    }
    if (row.desc) bits.push("<p>" + escapeHtml(row.desc) + "</p>");
    bits.push(
      '<p class="muted">Feature ' +
        escapeHtml(row.id) +
        (row.year ? " · source update year " + escapeHtml(String(row.year)) : "") +
        "</p>"
    );
    bits.push("</div>");
    return bits.join("");
  }

  function markerFor(row) {
    var color = TYPE_COLORS[row.type] || TYPE_COLORS.u;
    var radius = row.area ? 8 : 6;
    var marker = L.circleMarker([row.lat, row.lon], {
      radius: radius,
      color: color,
      weight: row.area ? 2 : 1,
      fillColor: color,
      fillOpacity: row.area ? 0.25 : 0.85,
      renderer: state.canvas,
    });
    marker.bindPopup(function () {
      return popupHtml(row);
    }, { maxWidth: 320 });
    return marker;
  }

  function ensureMap() {
    if (state.map) return;
    var el = $("europe-map");
    if (!el || typeof L === "undefined") return;
    state.canvas = L.canvas({ padding: 0.5 });
    state.map = L.map(el, {
      scrollWheelZoom: true,
      preferCanvas: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(state.map);
    // North Sea / Baltic / approaches, a reasonable starting view.
    state.map.setView([54.2, 6.5], 4);
    state.cluster = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 200,
      chunkDelay: 50,
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 12,
    });
    state.areas = L.layerGroup();
    state.map.addLayer(state.cluster);
    if (state.showAreas) state.map.addLayer(state.areas);
  }

  function refreshMap() {
    if (!state.map || !state.cluster) return;
    state.cluster.clearLayers();
    var status = $("europe-map-status");
    var rows = state.filtered;
    var layers = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.lat == null || r.lon == null) continue;
      layers.push(markerFor(r));
    }
    state.cluster.addLayers(layers);
    if (layers.length) {
      try {
        var b = state.cluster.getBounds();
        if (b && b.isValid()) state.map.fitBounds(b, { padding: [24, 24], maxZoom: 7 });
      } catch (e) {}
    }
    if (status) {
      status.textContent =
        layers.length.toLocaleString("en-US") +
        " mapped record" +
        (layers.length === 1 ? "" : "s") +
        " in the current filter" +
        (state.showAreas ? ", with official area outlines when available." : ".");
    }
    refreshAreas();
  }

  function refreshAreas() {
    if (!state.areas) return;
    state.areas.clearLayers();
    if (!state.showAreas) return;
    if (!state.geoms) {
      if (!state.geomsTried) loadGeoms();
      return;
    }
    var wanted = {};
    for (var i = 0; i < state.filtered.length; i++) {
      var r = state.filtered[i];
      if (r.hasGeom) wanted[r.id] = r;
    }
    var features = [];
    Object.keys(wanted).forEach(function (id) {
      var geom = state.geoms[id];
      if (!geom) return;
      features.push({
        type: "Feature",
        geometry: geom,
        properties: { id: id, type: wanted[id].type },
      });
    });
    if (!features.length) return;
    var layer = L.geoJSON(
      { type: "FeatureCollection", features: features },
      {
        style: function (feat) {
          var color = TYPE_COLORS[(feat.properties && feat.properties.type) || "u"];
          return {
            color: color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.15,
          };
        },
        onEachFeature: function (feat, lyr) {
          var row = wanted[feat.properties.id];
          if (row) {
            lyr.bindPopup(function () {
              return popupHtml(row);
            }, { maxWidth: 320 });
          }
        },
      }
    );
    state.areas.addLayer(layer);
  }

  function loadGeoms() {
    state.geomsTried = true;
    fetch(GEOMS_SRC, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("geoms " + res.status);
        return res.json();
      })
      .then(function (data) {
        state.geoms = data.geometries || data;
        refreshAreas();
      })
      .catch(function () {
        state.geoms = {};
      });
  }

  function bindControls() {
    var country = $("f-country");
    var type = $("f-type");
    var kind = $("f-kind");
    var search = $("f-search");
    var prev = $("europe-prev");
    var next = $("europe-next");
    var areas = $("f-areas");
    function onFilter() {
      state.country = country ? country.value : "";
      state.type = type ? type.value : "";
      state.kind = kind ? kind.value : "";
      state.query = search ? search.value.trim().toLowerCase() : "";
      state.page = 1;
      applyFilters();
    }
    if (country) country.addEventListener("change", onFilter);
    if (type) type.addEventListener("change", onFilter);
    if (kind) kind.addEventListener("change", onFilter);
    if (search) {
      var t;
      search.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(onFilter, 150);
      });
    }
    function goPrev() {
      if (state.page > 1) {
        state.page -= 1;
        renderCount();
        renderTable();
      }
    }
    function goNext() {
      var maxPage = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE) || 1);
      if (state.page < maxPage) {
        state.page += 1;
        renderCount();
        renderTable();
      }
    }
    if (prev) prev.addEventListener("click", goPrev);
    if (next) next.addEventListener("click", goNext);
    var prevB = $("europe-prev-bottom");
    var nextB = $("europe-next-bottom");
    if (prevB) prevB.addEventListener("click", goPrev);
    if (nextB) nextB.addEventListener("click", goNext);
    if (areas) {
      state.showAreas = areas.checked;
      areas.addEventListener("change", function () {
        state.showAreas = areas.checked;
        if (state.showAreas) {
          if (state.areas && state.map && !state.map.hasLayer(state.areas)) {
            state.map.addLayer(state.areas);
          }
          refreshAreas();
        } else if (state.areas && state.map) {
          state.map.removeLayer(state.areas);
        }
      });
    }
    var table = $("europe-table");
    if (table) {
      table.querySelectorAll("th[data-key]").forEach(function (th) {
        th.style.cursor = "pointer";
        th.addEventListener("click", function () {
          var key = th.getAttribute("data-key");
          if (state.sortKey === key) state.sortDir *= -1;
          else {
            state.sortKey = key;
            state.sortDir = 1;
          }
          table.querySelectorAll("th[data-key] .arrow").forEach(function (a) {
            a.textContent = "";
          });
          var arrow = th.querySelector(".arrow");
          if (arrow) arrow.textContent = state.sortDir === 1 ? "▲" : "▼";
          applyFilters();
        });
      });
    }
  }

  function setStatus(msg) {
    var el = $("europe-map-status");
    if (el) el.textContent = msg;
    var count = $("europe-count");
    if (count && !state.rows.length) count.textContent = msg;
  }

  function applyUrlState() {
    var params = new URLSearchParams(window.location.search);
    var country = $("f-country");
    var type = $("f-type");
    var kind = $("f-kind");
    var search = $("f-search");
    if (country && params.get("country")) country.value = params.get("country");
    if (type && params.get("type")) type.value = params.get("type");
    if (kind && params.get("kind")) kind.value = params.get("kind");
    if (search && params.get("q")) search.value = params.get("q");
    state.country = country ? country.value : "";
    state.type = type ? type.value : "";
    state.kind = kind ? kind.value : "";
    state.query = search ? search.value.trim().toLowerCase() : "";
  }

  function maybeScrollShot() {
    var params = new URLSearchParams(window.location.search);
    var target = null;
    if (params.get("shot") === "table" || window.location.hash === "#europe-table") {
      target = $("europe-table") || $("europe-count");
    }
    if (target && target.scrollIntoView) {
      target.scrollIntoView({ block: "start" });
    }
  }

  function init() {
    bindControls();
    setStatus("Loading records…");
    fetch(DATA_SRC, { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("data " + res.status);
        return res.json();
      })
      .then(function (data) {
        state.meta = data;
        state.rows = (data.sites || []).map(unpack);
        applyUrlState();
        ensureMap();
        applyFilters();
        if (state.showAreas) loadGeoms();
        maybeScrollShot();
      })
      .catch(function () {
        setStatus("The Europe records could not be loaded. Try refreshing the page.");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
