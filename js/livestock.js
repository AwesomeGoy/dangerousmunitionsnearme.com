/* U.S. poultry, cattle and hog layer, with state agency lists and EPA ATTAINS waters. Official sources only. Runs in the browser.
 * Permitted operations are not shown as proof of contamination. */
(function () {
  "use strict";
  var script = document.currentScript || document.querySelector("script[data-base], script[src*='livestock.js']");
  var base = (script && script.getAttribute("data-base")) || "";
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var VL = { verified: "Verified", corrected: "Corrected", unverified: "Unverified" };
  var GROUP_LABEL = { cattle: "Cattle or dairy", poultry: "Poultry", mixed: "Cattle and poultry", swine: "Hogs (swine)", unspecified: "CAFO, animal type not stated",
    nr: "Animal type not published in the state layer", water: "Water listed as impaired" };
  var LAYER_LABEL = {
    permit: "Permitted NPDES operation (not proof of contamination)",
    enforcement: "Documented NPDES enforcement or single-event violation",
    ia_dnr: "Iowa DNR listed operation (not proof of contamination)",
    state: "State agency listing (not proof of contamination)",
    attains: "Water officially listed as impaired, with an animal-feeding or grazing probable source (EPA ATTAINS)"
  };
  var STYLES = {
    permit: { radius: 6, color: "#1d4ed8", weight: 2, fillColor: "#93c5fd", fillOpacity: 0.9 },
    enforcement: { radius: 7, color: "#9f1239", weight: 2, fillColor: "#fb7185", fillOpacity: 0.95 },
    ia_dnr: { radius: 5, color: "#3f6212", weight: 1, fillColor: "#a3e635", fillOpacity: 0.85 },
    state: { radius: 5, color: "#6b21a8", weight: 1, fillColor: "#d8b4fe", fillOpacity: 0.85 },
    attains: { radius: 5, color: "#0e7490", weight: 2, fillColor: "#ecfeff", fillOpacity: 0.95 }
  };
  var CLOSED = /expired|terminated|inactive|revoked|withdrawn/i;
  var ACTIVE = { Effective: 1, "Administratively continued": 1, Active: 1, Pending: 1 };

  function unpack(payload) {
    var meta = payload.meta || {};
    var keys = payload.keys || meta.keys;
    var dflt = meta.defaults || null, pre = meta.state ? meta.state.toLowerCase() + "-" : "";
    return (payload.sites || []).map(function (row) {
      if (!Array.isArray(row)) return row;
      var o = {};
      if (dflt) Object.keys(dflt).forEach(function (k) { o[k] = dflt[k]; });
      keys.forEach(function (k, i) { o[k] = row[i]; });
      if (pre) { o.id = pre + o.id; if (!o.pn && o.la != null) o.pn = meta.pn_default || ""; o.src = meta.title; }
      return o;
    });
  }
  function load(url) {
    return fetch(base + url).then(function (r) {
      if (!r.ok) throw new Error("Could not load " + url);
      return r.json();
    });
  }
  function isActive(s) { return !!ACTIVE[s.ps]; }

  var state = {
    permit: true,
    enforcement: true,
    ia_dnr: false,
    cattle: true,
    poultry: true,
    mixed: true,
    swine: false,
    hogonly: false,
    unspecified: false,
    expired: false,
    attains: false,
    atf: true,
    atg: true,
    stl: {},
    st: "",
    q: "",
    page: 1,
    pageSize: 50
  };
  var all = [], iowaLoaded = false, attainsLoaded = false, stLoaded = {}, map, groups = {}, cluster, hpai;

  function matches(s) {
    if (s.k === "attains") {
      if (!state.attains || !((s.f && state.atf) || (s.gz && state.atg))) return false;
    } else if (state.hogonly) {
      if (!s.h) return false;
    } else if (s.g !== "nr" && !state[s.g]) return false;
    if (s.k === "state" && !state.stl[s.s]) return false;
    if (s.k === "state" && !state.expired && CLOSED.test(s.ps || "")) return false;
    if (s.k === "ia_dnr" && !state.ia_dnr) return false;
    if (s.k === "permit" && !state.permit) return false;
    if (s.k === "enforcement" && !state.enforcement) return false;
    if (!state.expired && s.k !== "ia_dnr" && !isActive(s) && s.k === "permit") return false;
    // enforcement records stay visible even if the permit expired
    if (state.st && s.s !== state.st) return false;
    if (state.q) {
      var hay = [s.n, s.c, s.co, s.s, s.id].filter(Boolean).join(" ").toLowerCase();
      if (hay.indexOf(state.q) === -1) return false;
    }
    return true;
  }

  function hogNote(s) { return s.h && s.g !== "swine" ? " · also lists swine" : ""; }
  function srcName(s) { return String(s.src || "").replace(/\(Nps\)/g, "(NPS)").replace(/Cafos/g, "CAFOs"); }
  function hmw(s) { return "https://mywaterway.epa.gov/waterbody-report/" + encodeURIComponent(s.org) + "/" + encodeURIComponent(s.id) + "/" + encodeURIComponent(s.cy); }
  function popupWater(s) {
    return "<strong>" + esc(LAYER_LABEL.attains) + ":</strong> " + esc(s.n) + " (" + esc(s.wt) + ", " + esc(s.s) + ")" +
      "<br>Probable source as listed: " + esc(srcName(s)) + (s.cf ? " (marked confirmed by the state)" : "") +
      "<br>Causes listed with these sources: " + esc(s.cz || "not stated") +
      "<br>Category " + esc(s.ir) + ", " + esc(s.cy) + " reporting cycle" +
      (s.gt === "line" || s.gt === "area" ? "<br><small>Point placed on the official ATTAINS " + esc(s.gt) + " geometry (one representative point per assessment unit).</small>" : "") +
      "<br><em>This is a state listing of a water, not a finding about any specific farm.</em>" +
      '<br><a href="' + esc(hmw(s)) + '">EPA How’s My Waterway report</a>';
  }
  function popup(s) {
    if (s.k === "attains") return popupWater(s);
    var approx = s.pn === "approximate" ? "<br><small>Approximate official point; collection method was not published or was address matching.</small>" : "";
    var note = s.k === "enforcement"
      ? "<br><em>This record has a documented formal enforcement action or single-event violation in ICIS-NPDES. That is not a finding that the operation currently contaminates air, water, or soil.</em>"
      : "<br><em>A permit or a state listing is not by itself proof of contamination.</em>";
    return "<strong>" + esc(LAYER_LABEL[s.k] || s.k) + ":</strong> " + esc(s.n) +
      "<br>" + esc([s.c, s.s].filter(Boolean).join(", ")) +
      " · " + esc(GROUP_LABEL[s.g] || s.g) + esc(hogNote(s)) +
      (s.ps ? " · " + esc(s.ps) : "") +
      (s.k === "state" ? "<br><small>" + esc(s.src || "") + (s.ad ? ". " + esc(s.ad) : "") + "</small>" : "") +
      " · <strong>" + esc(VL[s.v] || s.v) + "</strong>" +
      note + approx +
      (s.u ? '<br><a href="' + esc(s.u) + '">Official source</a>' : "");
  }

  function ensureCluster() {
    if (cluster) return cluster;
    if (typeof L.markerClusterGroup === "function") {
      cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48, chunkedLoading: true, chunkInterval: 40, chunkDelay: 20, disableClusteringAtZoom: 12 });
    } else {
      cluster = L.layerGroup();
    }
    cluster.addTo(map);
    return cluster;
  }

  function rebuildMap(vis) {
    if (!map) return;
    var c = ensureCluster();
    c.clearLayers();
    var pts = [], layers = [];
    vis.forEach(function (s) {
      if (s.la == null || s.lo == null) return;
      pts.push([s.la, s.lo]);
      var st = STYLES[s.k] || STYLES.permit;
      layers.push(L.circleMarker([s.la, s.lo], st).bindPopup(function () { return popup(s); }));
    });
    if (c.addLayers) c.addLayers(layers); else layers.forEach(function (m) { m.addTo(c); });
    var el = document.getElementById("lv-map-count");
    if (el) el.textContent = pts.length.toLocaleString("en-US") + " mapped of " + vis.length.toLocaleString("en-US") + " matching records";
    if (pts.length && vis.length && !rebuildMap._fitted) {
      map.fitBounds(pts, { padding: [20, 20], maxZoom: state.st ? 8 : 6 });
      rebuildMap._fitted = true;
    }
  }

  function fillStates(rows) {
    var sel = document.getElementById("lv-state");
    if (!sel) return;
    var seen = {}, have = {};
    [].forEach.call(sel.options, function (o) { if (o.value) have[o.value] = 1; });
    rows.forEach(function (s) { if (s.s) seen[s.s] = 1; });
    Object.keys(have).forEach(function (c) { seen[c] = 1; });
    var keep = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    Object.keys(seen).sort().forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = c; sel.appendChild(o);
    });
    sel.value = keep;
  }

  function renderTable(vis) {
    var tb = document.querySelector("#lv-table tbody");
    var cnt = document.getElementById("lv-count");
    var pager = document.getElementById("lv-pager");
    if (!tb) return;
    var total = vis.length;
    var pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * state.pageSize;
    var slice = vis.slice(start, start + state.pageSize);
    if (cnt) {
      var mapped = vis.filter(function (s) { return s.la != null; }).length;
      cnt.textContent = "Showing " + (total ? (start + 1) + "–" + (start + slice.length) : 0) +
        " of " + total.toLocaleString("en-US") + " matching records (" + mapped.toLocaleString("en-US") + " mapped, " +
        (total - mapped).toLocaleString("en-US") + " list-only).";
    }
    tb.innerHTML = slice.map(function (s) {
      if (s.k === "attains") return "<tr id=\"au-" + esc(s.id) + "\"><td>" + esc(s.n) + " (" + esc(s.wt) + ")</td><td>" + esc(s.s) +
        "</td><td>Probable source: " + esc(srcName(s)) + "</td><td>Water listed as impaired (EPA ATTAINS)</td><td>Category " + esc(s.ir) + ", " + esc(s.cy) +
        "</td><td>" + (s.cf ? "Source marked confirmed" : "Source listed as probable") + "</td><td>" +
        (s.la != null ? "Mapped (representative point)" : "List only") + '</td><td><a href="' + esc(hmw(s)) + '">How’s My Waterway</a></td></tr>';
      return "<tr id=\"" + esc(s.id) + "\"><td>" + esc(s.n) + "</td><td>" + esc([s.c, s.co, s.s].filter(Boolean).join(", ")) +
        "</td><td>" + esc(GROUP_LABEL[s.g] || s.g) + esc(hogNote(s)) + "</td><td>" + esc(s.k === "state" ? "State agency listing (" + s.s + ")" : (LAYER_LABEL[s.k] || s.k)) + "</td><td>" +
        esc(s.ps || "—") + "</td><td>" + esc(VL[s.v] || s.v) + "</td><td>" +
        (s.la != null ? (s.pn === "approximate" ? "Mapped (approximate)" : "Mapped") : "List only") + "</td><td>" +
        (s.u ? '<a href="' + esc(s.u) + '">Source</a>' : "—") + "</td></tr>";
    }).join("");
    if (pager) {
      pager.innerHTML = "";
      if (pages > 1) {
        var prev = document.createElement("button"); prev.type = "button"; prev.textContent = "Previous"; prev.disabled = state.page === 1;
        prev.addEventListener("click", function () { state.page--; apply(); });
        var next = document.createElement("button"); next.type = "button"; next.textContent = "Next"; next.disabled = state.page === pages;
        next.addEventListener("click", function () { state.page++; apply(); });
        var lab = document.createElement("span"); lab.textContent = " Page " + state.page + " of " + pages + " ";
        pager.append(prev, lab, next);
      }
    }
  }

  function apply() {
    var vis = all.filter(matches);
    rebuildMap(vis);
    renderTable(vis);
  }

  function bindFilters() {
    function hook(id, key, isCheck) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", function () {
        state[key] = isCheck ? el.checked : el.value;
        state.page = 1;
        if (key === "st") rebuildMap._fitted = false;
        if (key === "ia_dnr" && el.checked) loadIowa().then(apply);
        else if (key === "attains" && el.checked) loadAttains().then(apply);
        else apply();
      });
    }
    ["permit", "enforcement", "ia_dnr", "cattle", "poultry", "mixed", "swine", "hogonly", "unspecified", "expired", "attains", "atf", "atg"].forEach(function (k) {
      hook("lv-" + k, k, true);
    });
    [].forEach.call(document.querySelectorAll("input[data-lvstate]"), function (el) {
      el.addEventListener("change", function () {
        var st = el.getAttribute("data-lvstate");
        state.stl[st] = el.checked; state.page = 1;
        if (el.checked) loadState(st).then(apply, function (e) { var b = document.getElementById("lv-count"); if (b) b.textContent = e.message; });
        else apply();
      });
    });
    hook("lv-state", "st", false);
    var q = document.getElementById("lv-q");
    if (q) {
      var t;
      q.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () { state.q = (q.value || "").trim().toLowerCase(); state.page = 1; apply(); }, 200);
      });
    }
  }

  function loadIowa() {
    if (iowaLoaded) return Promise.resolve();
    return load("data/livestock/iowa.json").then(function (d) {
      all = all.concat(unpack(d));
      iowaLoaded = true;
      fillStates(all);
    });
  }

  function loadAttains() {
    if (attainsLoaded) return Promise.resolve();
    return load("data/livestock/attains.json").then(function (d) {
      all = all.concat(unpack(d).map(function (o) { o.k = "attains"; o.g = "water"; return o; }));
      attainsLoaded = true;
      fillStates(all);
    });
  }
  function loadState(st) {
    if (stLoaded[st]) return Promise.resolve();
    return load("data/livestock/states/" + st.toLowerCase() + ".json").then(function (d) {
      all = all.concat(unpack(d));
      stLoaded[st] = true;
      fillStates(all);
    });
  }

  function renderHpai(d) {
    function table(id, rows, cols, cells) {
      var el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = "<thead><tr>" + cols.map(function (c) { return "<th scope=\"col\">" + esc(c) + "</th>"; }).join("") +
        "</tr></thead><tbody>" + rows.map(function (r) {
          return "<tr>" + cells(r).map(function (v) { return "<td>" + v + "</td>"; }).join("") + "</tr>";
        }).join("") + "</tbody>";
    }
    var counties = (d.hpai_poultry_counties || []).slice().sort(function (a, b) { return (b.n - a.n) || a.state.localeCompare(b.state); });
    table("lv-hpai-poultry", counties, ["State", "County", "Confirmed detections", "Birds reported (sum, when given)", "First", "Last"], function (r) {
      return [esc(r.state), esc(r.county), String(r.n), r.birds_sum != null ? Number(r.birds_sum).toLocaleString("en-US") : "—", esc(r.first), esc(r.last)];
    });
    var states = (d.hpai_cattle_states || []).slice().sort(function (a, b) { return (b.n - a.n) || a.state.localeCompare(b.state); });
    table("lv-hpai-cattle", states, ["State", "Confirmed detections", "First", "Last", "Production types"], function (r) {
      return [esc(r.state), String(r.n), esc(r.first), esc(r.last), esc((r.productions || []).join(", "))];
    });
  }

  var el = document.getElementById("map");
  if (el && typeof L !== "undefined") {
    map = L.map(el, { scrollWheelZoom: false, worldCopyJump: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18
    }).addTo(map);
    map.setView([39.5, -98.35], 4);
  }

  bindFilters();
  // Start the 2 MB data download after the first paint, so the page text shows first.
  function start(fn) { if (document.readyState === "complete") setTimeout(fn, 0); else window.addEventListener("load", function () { setTimeout(fn, 0); }); }
  start(function () { Promise.all([load("data/livestock/permits.json"), load("data/livestock/hpai.json")]).then(function (res) {
    all = unpack(res[0]);
    hpai = res[1];
    fillStates(all);
    apply();
    setTimeout(function () { renderHpai(hpai); }, 0);
  }).catch(function (e) {
    var box = document.getElementById("lv-count");
    if (box) box.textContent = e.message;
  }); });
})();
