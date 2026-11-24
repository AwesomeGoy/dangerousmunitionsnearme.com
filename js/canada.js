(function () {
  const table = document.getElementById("canada-table");
  const mapEl = document.getElementById("canada-map");
  const dataEl = document.getElementById("canada-map-data");
  const fProvince = document.getElementById("f-province");
  const fStatus = document.getElementById("f-status");
  const fSector = document.getElementById("f-sector");
  const fPrecision = document.getElementById("f-precision");
  const fSearch = document.getElementById("f-search");
  const countEl = document.getElementById("canada-count");
  const emptyEl = document.getElementById("canada-empty");

  const rows = table ? Array.from(table.querySelector("tbody").querySelectorAll("tr")) : [];
  const total = rows.length;
  let sortKey = "province";
  let sortDir = 1;

  let mapped = [];
  if (dataEl) {
    try {
      mapped = JSON.parse(dataEl.textContent || "[]") || [];
    } catch (err) {
      mapped = [];
    }
  }

  function escapeText(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function rowValue(row, key) {
    if (key === "name") return (row.getAttribute("data-name") || "").toLowerCase();
    if (key === "site_id") return (row.getAttribute("data-site-id") || "").toLowerCase();
    if (key === "province") return (row.getAttribute("data-province") || "").toLowerCase();
    if (key === "status") return (row.getAttribute("data-status") || "").toLowerCase();
    if (key === "sector") return (row.getAttribute("data-sector") || "").toLowerCase();
    if (key === "precision") return (row.getAttribute("data-precision") || "").toLowerCase();
    return "";
  }

  function sortRows(visible) {
    if (!table) return;
    const tbody = table.querySelector("tbody");
    visible.sort((a, b) => {
      const av = rowValue(a, sortKey);
      const bv = rowValue(b, sortKey);
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      const an = rowValue(a, "name");
      const bn = rowValue(b, "name");
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });
    visible.forEach((row) => tbody.appendChild(row));
  }

  function passes(row) {
    const okProv = !fProvince || !fProvince.value || row.getAttribute("data-province") === fProvince.value;
    const okStatus = !fStatus || !fStatus.value || row.getAttribute("data-status") === fStatus.value;
    const okSector = !fSector || !fSector.value || row.getAttribute("data-sector") === fSector.value;
    const okPrec = !fPrecision || !fPrecision.value || row.getAttribute("data-precision") === fPrecision.value;
    const q = (fSearch && fSearch.value || "").trim().toLowerCase();
    let okSearch = true;
    if (q) {
      const hay = (
        (row.getAttribute("data-name") || "") +
        " " +
        (row.getAttribute("data-site-id") || "") +
        " " +
        (row.getAttribute("data-city") || "")
      ).toLowerCase();
      okSearch = hay.indexOf(q) !== -1;
    }
    return okProv && okStatus && okSector && okPrec && okSearch;
  }

  function passesSite(s) {
    const okProv = !fProvince || !fProvince.value || s.province === fProvince.value;
    const okStatus = !fStatus || !fStatus.value || s.status === fStatus.value;
    const okSector = !fSector || !fSector.value || s.sector === fSector.value;
    const okPrec = !fPrecision || !fPrecision.value || s.coord_precision === fPrecision.value;
    const q = (fSearch && fSearch.value || "").trim().toLowerCase();
    let okSearch = true;
    if (q) {
      const hay = ((s.name || "") + " " + (s.site_id || "") + " " + (s.city || "")).toLowerCase();
      okSearch = hay.indexOf(q) !== -1;
    }
    return okProv && okStatus && okSector && okPrec && okSearch;
  }

  const markerStyle = {
    exact: { color: "#0f766e", fillColor: "#0f766e", fillOpacity: 0.85, weight: 2, radius: 7, dashArray: null },
    place_name_approx: { color: "#b45309", fillColor: "#fbbf24", fillOpacity: 0.35, weight: 2, radius: 8, dashArray: "4 3" }
  };

  let map, layerGroup, originLayer;

  function markerOpts(precision) {
    const key = precision === "place_name_approx" ? "place_name_approx" : "exact";
    const s = markerStyle[key];
    return {
      radius: s.radius,
      color: s.color,
      weight: s.weight,
      fillColor: s.fillColor,
      fillOpacity: s.fillOpacity,
      dashArray: s.dashArray || undefined
    };
  }

  function precisionPhrase(p) {
    if (p === "place_name_approx") return "Approximate location (official place name, not a surveyed site point)";
    if (p === "exact") return "Official coordinates";
    return "Location precision not stated";
  }

  function popupHtml(s) {
    const loc = [s.city, s.province_label || s.province].filter(Boolean).join(", ");
    const bits = [
      "<strong>" + escapeText(s.name) + "</strong>",
      s.site_id ? escapeText(s.site_id) : "",
      loc ? escapeText(loc) : "",
      s.status ? "Status: " + escapeText(s.status) : "",
      s.sector_label ? "Sector: " + escapeText(s.sector_label) : "",
      "<em>" + escapeText(precisionPhrase(s.coord_precision)) + "</em>",
      s.coord_source ? "Source: " + escapeText(s.coord_source) : ""
    ].filter(Boolean);
    return bits.join("<br>");
  }

  function initMap() {
    if (!mapEl || typeof L === "undefined" || !mapped.length) return null;
    map = L.map("canada-map", { scrollWheelZoom: true }).setView([56.2, -96], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18
    }).addTo(map);
    layerGroup = L.layerGroup().addTo(map);
    return map;
  }

  function renderMarkers() {
    if (!map || !layerGroup) return;
    layerGroup.clearLayers();
    const pts = [];
    mapped.forEach((s) => {
      if (!passesSite(s)) return;
      const lat = Number(s.latitude);
      const lon = Number(s.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return;
      const m = L.circleMarker([lat, lon], markerOpts(s.coord_precision));
      m.bindPopup(popupHtml(s));
      m.addTo(layerGroup);
      pts.push([lat, lon]);
    });
    if (pts.length) {
      const bounds = L.latLngBounds(pts);
      if (originLayer) bounds.extend(originLayer.getLatLng());
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: pts.length === 1 ? 8 : 6 });
    } else {
      map.setView([56.2, -96], 4);
    }
  }

  function render() {
    const visible = [];
    rows.forEach((row) => {
      const show = passes(row);
      row.hidden = !show;
      if (show) visible.push(row);
    });
    sortRows(visible);
    if (countEl) {
      const label = total === 1 ? "site" : "sites";
      countEl.textContent = "Showing " + visible.length + " of " + total + " " + label + ".";
    }
    if (emptyEl) {
      emptyEl.hidden = visible.length !== 0 || total === 0;
    }
    if (table) {
      table.querySelectorAll("th[data-key] .arrow").forEach((el) => {
        el.textContent = "";
      });
      const active = table.querySelector('th[data-key="' + sortKey + '"] .arrow');
      if (active) active.textContent = sortDir === 1 ? "▲" : "▼";
    }
    renderMarkers();
  }

  if (table) {
    table.querySelectorAll("th[data-key]").forEach((th) => {
      th.tabIndex = 0;
      th.setAttribute("role", "button");
      const go = function () {
        const key = th.getAttribute("data-key");
        if (sortKey === key) {
          sortDir = -sortDir;
        } else {
          sortKey = key;
          sortDir = 1;
        }
        render();
      };
      th.addEventListener("click", go);
      th.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
    });
  }

  [fProvince, fStatus, fSector, fPrecision].forEach((el) => {
    if (el) el.addEventListener("change", render);
  });
  if (fSearch) fSearch.addEventListener("input", render);

  initMap();
  render();

  // Postal / FSA search — only wired when the form and centroid table exist.
  const form = document.getElementById("canada-fsa-form");
  const fsaInput = document.getElementById("canada-fsa");
  const resultsEl = document.getElementById("canada-fsa-results");
  const FSA_URL = (form && form.getAttribute("data-fsa-src")) || "../data/fsa-centroids.json";
  let fsaTable = null;
  let fsaLoading = null;

  function kmBetween(lat1, lon1, lat2, lon2) {
    const r = 6371;
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(km) {
    const miles = km * 0.621371;
    const kmText = km < 10 ? km.toFixed(1) : String(Math.round(km));
    const miText = miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
    return kmText + " km (" + miText + " mi)";
  }

  function normalizeFsa(raw) {
    const compact = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (compact.length >= 3 && /^[A-Z]\d[A-Z]/.test(compact)) return compact.slice(0, 3);
    return "";
  }

  function loadFsa() {
    if (fsaTable) return Promise.resolve(fsaTable);
    if (!fsaLoading) {
      fsaLoading = fetch(FSA_URL)
        .then((r) => {
          if (!r.ok) throw new Error("Could not load the FSA centroid table.");
          return r.json();
        })
        .then((t) => {
          fsaTable = t;
          return t;
        })
        .catch((err) => {
          fsaLoading = null;
          throw err;
        });
    }
    return fsaLoading;
  }

  function setFsaMessage(msg, isError) {
    if (!resultsEl) return;
    resultsEl.innerHTML = '<p class="' + (isError ? "nearby-error" : "") + '">' + escapeText(msg) + "</p>";
  }

  function showOrigin(lat, lon, label) {
    if (!map) return;
    if (originLayer) {
      map.removeLayer(originLayer);
      originLayer = null;
    }
    originLayer = L.circleMarker([lat, lon], {
      radius: 8,
      color: "#1e3a5f",
      weight: 2,
      fillColor: "#f7f4ef",
      fillOpacity: 1
    }).addTo(map);
    originLayer.bindPopup(label).openPopup();
  }

  function renderFsaResults(lat, lon, heading) {
    const ranked = mapped
      .map((s) => {
        const km = kmBetween(lat, lon, Number(s.latitude), Number(s.longitude));
        return { site: s, km: km };
      })
      .filter((r) => !Number.isNaN(r.km))
      .sort((a, b) => a.km - b.km);
    const within = ranked.filter((r) => r.km <= 160.934);
    const picked = [];
    const seen = {};
    ranked.slice(0, 5).forEach((r) => {
      seen[r.site.id] = true;
      picked.push(r);
    });
    within.forEach((r) => {
      if (!seen[r.site.id]) {
        seen[r.site.id] = true;
        picked.push(r);
      }
    });
    picked.sort((a, b) => a.km - b.km);
    if (!picked.length) {
      setFsaMessage("No mapped sites in this draft have coordinates, so a nearby list cannot be calculated.", true);
      return;
    }
    const withinCount = picked.filter((r) => r.km <= 160.934).length;
    let summary = "Showing the closest " + Math.min(5, picked.length) + " mapped site" + (Math.min(5, picked.length) === 1 ? "" : "s");
    if (withinCount > 5) {
      summary += ", plus " + (withinCount - 5) + " more within 160 km (100 miles)";
    } else if (withinCount === 0) {
      summary += ". None of the mapped sites in this draft are within 160 km (100 miles)";
    }
    summary += ". Unmapped sites are not included. Some pins are approximate place-name locations, not surveyed site points.";
    const items = picked
      .map((r) => {
        const loc = [r.site.city, r.site.province_label || r.site.province].filter(Boolean).join(", ");
        const prec = r.site.coord_precision === "place_name_approx" ? " — approximate (place name)" : "";
        return (
          "<li><strong>" +
          escapeText(r.site.name) +
          "</strong> — <span class=\"miles\">" +
          formatDistance(r.km) +
          "</span>" +
          (loc ? " — " + escapeText(loc) : "") +
          escapeText(prec) +
          "</li>"
        );
      })
      .join("");
    resultsEl.innerHTML =
      "<h3>" + escapeText(heading) + "</h3><p>" + escapeText(summary) + "</p><ol>" + items + "</ol>";
    showOrigin(lat, lon, heading);
    if (map) {
      const bounds = [[lat, lon]].concat(
        picked.map((r) => [Number(r.site.latitude), Number(r.site.longitude)])
      );
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 9 });
    }
  }

  if (form && fsaInput && resultsEl) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const fsa = normalizeFsa(fsaInput.value);
      if (!fsa) {
        setFsaMessage("Please enter a Canadian postal code or FSA (the first three characters, for example K1A or V9A).", true);
        fsaInput.focus();
        return;
      }
      fsaInput.value = fsa;
      setFsaMessage("Looking up that FSA…");
      loadFsa()
        .then((table) => {
          const rec = table[fsa] || (table.centroids && table.centroids[fsa]) || null;
          const coord = Array.isArray(rec) ? rec : rec && (rec.centroid || rec.lat != null) ? rec : null;
          let lat, lon;
          if (Array.isArray(coord) && coord.length >= 2) {
            lat = Number(coord[0]);
            lon = Number(coord[1]);
          } else if (coord && coord.lat != null && coord.lon != null) {
            lat = Number(coord.lat);
            lon = Number(coord.lon);
          } else if (coord && coord.latitude != null && coord.longitude != null) {
            lat = Number(coord.latitude);
            lon = Number(coord.longitude);
          }
          if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
            setFsaMessage(
              "No Statistics Canada 2021 census FSA centroid was found for " + fsa + ". Census FSAs are not identical to every Canada Post FSA.",
              true
            );
            return;
          }
          renderFsaResults(lat, lon, "Mapped sites near " + fsa);
        })
        .catch(function () {
          setFsaMessage("The FSA centroid table could not be loaded. Please try again.", true);
        });
    });
  }
})();
