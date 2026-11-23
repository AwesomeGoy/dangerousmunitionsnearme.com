(function () {
  const script = document.currentScript;
  const DATA_URL = (script && script.getAttribute("data-src")) || "data/sites.json";
  const ICON_PATH = (script && script.getAttribute("data-icon-path")) || "lib/leaflet/images/";
  const ZCTA_URL = (script && script.getAttribute("data-zcta-src")) || "data/zcta-centroids.json";

  const badgeClass = (v) => {
    const s = (v || "").toLowerCase();
    if (s.indexOf("unverified") !== -1 && s.indexOf("partly") === -1) return "unverified";
    if (s.indexOf("partly") !== -1) return "partly";
    if (s.indexOf("verified") !== -1) return "verified";
    return "unverified";
  };

  const colorFor = (v) => {
    const c = badgeClass(v);
    return { verified: "#166534", partly: "#b45309", unverified: "#57534e" }[c];
  };

  const unique = (arr) => Array.from(new Set(arr.filter(Boolean))).sort();

  const joinTypes = (t) => (Array.isArray(t) ? t.join(", ") : (t || ""));

  const SECTOR_LABELS = {
    army: "Army",
    navy: "Navy",
    air_force: "Air Force",
    marines: "Marines",
    other_dod: "Other DoD",
    doe: "Department of Energy",
    nasa: "NASA",
    contractor: "Contractor",
    other: "Other"
  };
  const SECTOR_ORDER = ["army","navy","air_force","marines","other_dod","doe","nasa","contractor","other"];
  const sectorLabel = (s) => SECTOR_LABELS[s] || s || "";

  function populateSectorSelect(sel, values) {
    if (!sel) return;
    sel.innerHTML = "";
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "All sectors";
    sel.appendChild(all);
    const set = new Set(values.filter(Boolean));
    const ordered = SECTOR_ORDER.filter((v) => set.has(v)).concat(
      Array.from(set).filter((v) => SECTOR_ORDER.indexOf(v) === -1).sort()
    );
    ordered.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = sectorLabel(v);
      sel.appendChild(o);
    });
  }

  const EARTH_MI = 3958.7613;

  function milesBetween(aLat, aLon, bLat, bLon) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * EARTH_MI * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function formatMiles(mi) {
    if (mi < 0.1) return "< 0.1 miles";
    return mi.toFixed(1) + " miles";
  }

  function escapeText(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  function populateSelect(sel, values, allLabel) {
    sel.innerHTML = "";
    const all = document.createElement("option");
    all.value = "";
    all.textContent = allLabel;
    sel.appendChild(all);
    values.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
  }

  function init(data) {
    const sites = data.sites || [];
    const q = document.getElementById("q");
    const fState = document.getElementById("f-state");
    const fSector = document.getElementById("f-sector");
    const fBranch = document.getElementById("f-branch");
    const fType = document.getElementById("f-type");
    const fVer = document.getElementById("f-verification");
    const fDepth = document.getElementById("f-depth");
    const countEl = document.getElementById("count");
    const tbody = document.querySelector("#sites-table tbody");
    const thead = document.querySelector("#sites-table thead");

    populateSelect(fState, unique(sites.map((s) => s.state)), "All states");
    populateSectorSelect(fSector, unique(sites.map((s) => s.sector)));
    populateSelect(fBranch, unique(sites.map((s) => s.branch)), "All branches");
    populateSelect(fType, unique(sites.flatMap((s) => s.type || [])), "All types");
    populateSelect(fVer, unique(sites.map((s) => s.verification)), "All labels");
    populateSelect(fDepth, unique(sites.map((s) => s.research_depth)), "All depths");

    const map = L.map("map", { scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    L.Icon.Default.imagePath = ICON_PATH;

    const layer = L.layerGroup().addTo(map);
    const markersById = {};

    function passes(s) {
      const query = (q.value || "").trim().toLowerCase();
      if (query) {
        const hay = [s.name, s.city, s.state, s.branch, s.sector, sectorLabel(s.sector), s.epa_id, joinTypes(s.type), s.known_energetics, s.current_status]
          .join(" ")
          .toLowerCase();
        if (hay.indexOf(query) === -1) return false;
      }
      if (fState.value && s.state !== fState.value) return false;
      if (fSector && fSector.value && s.sector !== fSector.value) return false;
      if (fBranch.value && s.branch !== fBranch.value) return false;
      if (fType.value && !(s.type || []).includes(fType.value)) return false;
      if (fVer.value && s.verification !== fVer.value) return false;
      if (fDepth.value && s.research_depth !== fDepth.value) return false;
      return true;
    }

    let sortKey = "name";
    let sortDir = 1;

    function sortSites(list) {
      return list.slice().sort((a, b) => {
        const av = (a[sortKey] ?? "").toString().toLowerCase();
        const bv = (b[sortKey] ?? "").toString().toLowerCase();
        if (av < bv) return -1 * sortDir;
        if (av > bv) return 1 * sortDir;
        return 0;
      });
    }

    function hrefFor(s) {
      return "sites/" + encodeURIComponent(s.id) + ".html";
    }

    function render() {
      const visible = sortSites(sites.filter(passes));
      countEl.textContent =
        "Showing " + visible.length + " of " + sites.length + " sites.";
      layer.clearLayers();
      const bounds = [];
      visible.forEach((s) => {
        if (s.latitude == null || s.longitude == null || s.latitude === "" || s.longitude === "") return;
        const lat = Number(s.latitude);
        const lon = Number(s.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
        const m = L.circleMarker([lat, lon], {
          radius: s.research_depth === "deep" ? 9 : 7,
          color: "#1c1917",
          weight: 1,
          fillColor: colorFor(s.verification),
          fillOpacity: 0.9,
        });
        m.bindPopup(
          "<strong><a href=\"" + hrefFor(s) + "\">" +
            (s.name || "").replace(/</g, "&lt;") +
            "</a></strong>" +
            [s.city, s.state].filter(Boolean).join(", ") +
            "<br>" +
            (sectorLabel(s.sector) || s.branch || "") +
            (s.branch && sectorLabel(s.sector) ? " · " + s.branch : "") +
            "<br><span class=\"badge " + badgeClass(s.verification) + "\">" +
            (s.verification || "") +
            "</span>"
        );
        m.addTo(layer);
        markersById[s.id] = m;
        bounds.push([lat, lon]);
      });
      if (bounds.length) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 5 });
      } else {
        map.setView([39.8, -98.5], 3);
      }

      tbody.innerHTML = "";
      visible.forEach((s) => {
        const tr = document.createElement("tr");
        const loc = [s.city, s.state].filter(Boolean).join(", ");
        tr.innerHTML =
          "<td><a href=\"" + hrefFor(s) + "\">" + (s.name || "").replace(/</g, "&lt;") + "</a></td>" +
          "<td>" + sectorLabel(s.sector).replace(/</g, "&lt;") + "</td>" +
          "<td>" + (s.branch || "").replace(/</g, "&lt;") + "</td>" +
          "<td>" + loc.replace(/</g, "&lt;") + "</td>" +
          "<td class=\"types\">" + joinTypes(s.type).replace(/</g, "&lt;") + "</td>" +
          "<td><span class=\"badge " + badgeClass(s.verification) + "\">" +
          (s.verification || "").replace(/</g, "&lt;") +
          "</span></td>" +
          "<td><span class=\"badge depth\">" + (s.research_depth || "").replace(/</g, "&lt;") + "</span></td>";
        tbody.appendChild(tr);
      });
    }

    ["input", "change"].forEach((ev) => {
      [q, fState, fSector, fBranch, fType, fVer, fDepth].forEach((el) => el && el.addEventListener(ev, render));
    });

    thead.addEventListener("click", (e) => {
      const th = e.target.closest("th[data-key]");
      if (!th) return;
      const key = th.getAttribute("data-key");
      if (sortKey === key) sortDir *= -1;
      else {
        sortKey = key;
        sortDir = 1;
      }
      thead.querySelectorAll(".arrow").forEach((a) => (a.textContent = ""));
      const arrow = th.querySelector(".arrow");
      if (arrow) arrow.textContent = sortDir === 1 ? "▲" : "▼";
      render();
    });


    let zctaTable = null;
    let zctaLoading = null;
    let originLayer = null;

    function loadZcta() {
      if (zctaTable) return Promise.resolve(zctaTable);
      if (!zctaLoading) {
        zctaLoading = fetch(ZCTA_URL)
          .then((r) => {
            if (!r.ok) throw new Error("Could not load the ZIP centroid table.");
            return r.json();
          })
          .then((t) => {
            zctaTable = t;
            return t;
          })
          .catch((err) => {
            zctaLoading = null;
            throw err;
          });
      }
      return zctaLoading;
    }

    function rankedSites(lat, lon) {
      return sites
        .filter((s) => s.latitude != null && s.longitude != null && s.latitude !== "" && s.longitude !== "")
        .map((s) => ({
          site: s,
          miles: milesBetween(lat, lon, Number(s.latitude), Number(s.longitude)),
        }))
        .filter((r) => !Number.isNaN(r.miles))
        .sort((a, b) => a.miles - b.miles);
    }

    function pickNearby(ranked) {
      const within = ranked.filter((r) => r.miles <= 100);
      const seen = {};
      const out = [];
      ranked.slice(0, 5).forEach((r) => {
        seen[r.site.id] = true;
        out.push(r);
      });
      within.forEach((r) => {
        if (!seen[r.site.id]) {
          seen[r.site.id] = true;
          out.push(r);
        }
      });
      out.sort((a, b) => a.miles - b.miles);
      return out;
    }

    function showOrigin(lat, lon, label) {
      if (originLayer) {
        map.removeLayer(originLayer);
        originLayer = null;
      }
      originLayer = L.circleMarker([lat, lon], {
        radius: 8,
        color: "#1e3a5f",
        weight: 2,
        fillColor: "#f7f4ef",
        fillOpacity: 1,
      }).addTo(map);
      originLayer.bindPopup(label).openPopup();
    }

    function renderNearby(lat, lon, heading, originLabel) {
      const resultsEl = document.getElementById("nearby-results");
      const ranked = rankedSites(lat, lon);
      const picked = pickNearby(ranked);
      if (!picked.length) {
        resultsEl.innerHTML = '<p class="nearby-error">No sites in this draft have coordinates, so a nearby list cannot be calculated.</p>';
        return;
      }
      const withinCount = picked.filter((r) => r.miles <= 100).length;
      let summary =
        "Showing the closest " +
        Math.min(5, picked.length) +
        " site" +
        (Math.min(5, picked.length) === 1 ? "" : "s");
      if (withinCount > 5) {
        summary += ", plus " + (withinCount - 5) + " more within 100 miles";
      } else if (withinCount === 0) {
        summary += ". None of the sites in this draft are within 100 straight-line miles";
      }
      summary += ".";
      const items = picked
        .map((r) => {
          const loc = [r.site.city, r.site.state].filter(Boolean).join(", ");
          return (
            "<li><a href=\"" +
            hrefFor(r.site) +
            "\">" +
            escapeText(r.site.name) +
            "</a> — <span class=\"miles\">" +
            formatMiles(r.miles) +
            "</span>" +
            (loc ? " — " + escapeText(loc) : "") +
            "</li>"
          );
        })
        .join("");
      resultsEl.innerHTML =
        "<h3>" +
        escapeText(heading) +
        "</h3><p>" +
        escapeText(summary) +
        "</p><ol>" +
        items +
        "</ol>";
      showOrigin(lat, lon, originLabel);
      const bounds = [[lat, lon]].concat(
        picked.map((r) => [Number(r.site.latitude), Number(r.site.longitude)])
      );
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 10 });
    }

    function setNearbyMessage(msg, isError) {
      const resultsEl = document.getElementById("nearby-results");
      if (!resultsEl) return;
      resultsEl.innerHTML = '<p class="' + (isError ? "nearby-error" : "") + '">' + escapeText(msg) + "</p>";
    }

    const form = document.getElementById("nearby-form");
    const zipInput = document.getElementById("nearby-zip");
    const geoBtn = document.getElementById("nearby-geo");

    if (form && zipInput) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const zip = (zipInput.value || "").trim();
        if (!/^\d{5}$/.test(zip)) {
          setNearbyMessage("Please enter a five-digit U.S. ZIP code.", true);
          zipInput.focus();
          return;
        }
        setNearbyMessage("Looking up that ZIP…");
        loadZcta()
          .then((table) => {
            const coord = table[zip];
            if (!coord || coord.length < 2) {
              setNearbyMessage(
                "ZIP " +
                  zip +
                  " is not in the Census 2025 ZCTA list used by this draft. Not every postal ZIP has a ZCTA centroid, so a distance cannot be calculated for this code.",
                true
              );
              return;
            }
            renderNearby(
              coord[0],
              coord[1],
              "Nearest sites to ZIP " + zip,
              "ZIP " + zip + " (Census ZCTA center)"
            );
          })
          .catch((err) => {
            setNearbyMessage(err.message || "Could not load the ZIP centroid table.", true);
          });
      });
    }

    if (geoBtn) {
      geoBtn.addEventListener("click", () => {
        if (!navigator.geolocation) {
          setNearbyMessage("This browser does not support location lookup.", true);
          return;
        }
        setNearbyMessage("Asking this browser for your location. Nothing is sent to a server.");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            renderNearby(lat, lon, "Nearest sites to your location", "Your location (from this browser)");
          },
          (err) => {
            let msg = "Could not get your location.";
            if (err && err.code === 1) msg = "Location permission was denied. You can still search by ZIP code.";
            else if (err && err.code === 2) msg = "Your location was unavailable. You can still search by ZIP code.";
            else if (err && err.code === 3) msg = "The location request timed out. You can still search by ZIP code.";
            setNearbyMessage(msg, true);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
        );
      });
    }

    render();
  }

  fetch(DATA_URL)
    .then((r) => {
      if (!r.ok) throw new Error("Could not load sites.json");
      return r.json();
    })
    .then(init)
    .catch((err) => {
      const el = document.getElementById("count");
      if (el) el.textContent = "Could not load the dataset: " + err.message;
    });
})();
