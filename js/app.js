(function () {
  const script = document.currentScript;
  const DATA_URL = (script && script.getAttribute("data-src")) || "data/sites.json";
  const ICON_PATH = (script && script.getAttribute("data-icon-path")) || "lib/leaflet/images/";

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
    const fBranch = document.getElementById("f-branch");
    const fType = document.getElementById("f-type");
    const fVer = document.getElementById("f-verification");
    const fDepth = document.getElementById("f-depth");
    const countEl = document.getElementById("count");
    const tbody = document.querySelector("#sites-table tbody");
    const thead = document.querySelector("#sites-table thead");

    populateSelect(fState, unique(sites.map((s) => s.state)), "All states");
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
        const hay = [s.name, s.city, s.state, s.branch, s.epa_id, joinTypes(s.type), s.known_energetics, s.current_status]
          .join(" ")
          .toLowerCase();
        if (hay.indexOf(query) === -1) return false;
      }
      if (fState.value && s.state !== fState.value) return false;
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
            (s.branch || "") +
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
      [q, fState, fBranch, fType, fVer, fDepth].forEach((el) => el.addEventListener(ev, render));
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
