/* PFAS + Superfund layers for Dangerous Munitions Near Me.
 * Data: data/superfund.json (EPA NPL) and data/pfas.json (DoD PFAS status chart).
 * Runs in the browser only. No ZIP or location is sent to a server.
 * Modes (data-mode): "zip" (adds results under the ZIP search), "pfas", "superfund" (list pages). */
(function () {
  var script = document.currentScript;
  var MODE = (script && script.getAttribute("data-mode")) || "zip";
  var cache = {};
  function load(url) {
    if (!cache[url]) cache[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error("Could not load " + url); return r.json(); });
    return cache[url];
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function miles(aLat, aLon, bLat, bLon) {
    var R = 3958.7613, t = Math.PI / 180;
    var dLat = (bLat - aLat) * t, dLon = (bLon - aLon) * t;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(aLat * t) * Math.cos(bLat * t) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function fmt(mi) { return mi < 0.1 ? "< 0.1 miles" : mi.toFixed(1) + " miles"; }
  var SF_LABEL = { active: "On the Superfund list", proposed: "Proposed for the Superfund list", deleted: "Deleted from the Superfund list" };
  function sfMeta(s, meta) {
    return SF_LABEL[s.st] + (s.f ? " · Federal facility" : "") + (s.ld ? " · Listed " + s.ld : "") + (s.dd ? " · Deleted " + s.dd : "") +
      " · Source: EPA NPL, data as of " + meta.data_date;
  }
  function pfMeta(p, meta) {
    return p.comp + " " + p.t + " · DoD status: " + p.cs + (p.ia ? " · Interim action listed" : "") + " · Source: DoD PFAS status chart, data as of " + meta.data_date;
  }

  /* ---------- ZIP search mode ---------- */
  function zipMode() {
    var box = document.getElementById("env-results");
    var form = document.getElementById("nearby-form");
    var zipInput = document.getElementById("nearby-zip");
    var geoBtn = document.getElementById("nearby-geo");
    var munitionsEl = document.getElementById("nearby-results");
    if (!box || !form) return;
    var map = null, mapLayer = null, last = null;
    var state = { mun: true, pfas: true, sf: true, deleted: false };

    function filtersHtml() {
      return '<fieldset class="env-filter-set"><legend>Show these site types</legend>' +
        '<label class="env-check"><input type="checkbox" data-k="mun"' + (state.mun ? " checked" : "") + '> <span class="env-tag env-tag--mun">Munitions</span></label>' +
        '<label class="env-check"><input type="checkbox" data-k="pfas"' + (state.pfas ? " checked" : "") + '> <span class="env-tag env-tag--pfas">Military PFAS</span></label>' +
        '<label class="env-check"><input type="checkbox" data-k="sf"' + (state.sf ? " checked" : "") + '> <span class="env-tag env-tag--sf">Superfund</span></label>' +
        '<label class="env-check"><input type="checkbox" data-k="deleted"' + (state.deleted ? " checked" : "") + '> Include deleted (cleaned-up) Superfund sites</label></fieldset>';
    }

    function render(lat, lon, label) {
      last = { lat: lat, lon: lon, label: label };
      box.hidden = false;
      box.innerHTML = "<p>Loading PFAS and Superfund layers…</p>";
      Promise.all([load("data/superfund.json"), load("data/pfas.json")]).then(function (res) {
        var sf = res[0], pf = res[1];
        var sfRanked = sf.sites.filter(function (s) { return state.deleted || s.st !== "deleted"; })
          .map(function (s) { return { s: s, mi: miles(lat, lon, s.la, s.lo) }; })
          .sort(function (a, b) { return a.mi - b.mi; });
        var sfPick = sfRanked.filter(function (r, i) { return i < 5 || (r.mi <= 10 && i < 15); });
        var pfRanked = pf.installations.filter(function (p) { return p.la != null && p.lo != null; })
          .map(function (p) { return { s: p, mi: miles(lat, lon, p.la, p.lo) }; })
          .sort(function (a, b) { return a.mi - b.mi; });
        var pfPick = pfRanked.filter(function (r, i) { return i < 5 || (r.mi <= 50 && i < 15); });

        var h = filtersHtml();
        h += '<section class="env-group" data-group="pfas"' + (state.pfas ? "" : " hidden") + '><h3><span class="env-tag env-tag--pfas">Military PFAS</span> Nearest military sites DoD is checking for PFAS</h3>';
        if (pfPick.length) {
          h += "<ol>" + pfPick.map(function (r) {
            return '<li><a href="' + esc(pf.meta.source_url) + '">' + esc(r.s.n) + "</a> — <span class=\"miles\">" + fmt(r.mi) + "</span> — " + esc(r.s.sn) +
              '<div class="env-meta">' + esc(pfMeta(r.s, pf.meta)) + "</div></li>";
          }).join("") + "</ol>";
        }
        if (pf.meta.geocoded < pf.meta.count) {
          h += '<p class="env-meta">' + (pfPick.length ? "Only " + pf.meta.geocoded + " of " : "Locations for the ") + pf.meta.count +
            ' installations DoD is checking for PFAS ' + (pfPick.length ? "are mapped so far." : "are still being mapped, so distances are not shown yet.") +
            ' See the <a href="pfas.html#pfas-list-heading">full list by state</a> (DoD data as of ' + esc(pf.meta.data_date) + ").</p>";
        }
        h += "</section>";
        h += '<section class="env-group" data-group="sf"' + (state.sf ? "" : " hidden") + '><h3><span class="env-tag env-tag--sf">Superfund</span> Nearest Superfund (NPL) sites</h3><ol>';
        h += sfPick.map(function (r) {
          return '<li><a href="' + esc(r.s.u) + '">' + esc(r.s.n) + "</a> — <span class=\"miles\">" + fmt(r.mi) + "</span> — " + esc([r.s.c, r.s.s].filter(Boolean).join(", ")) +
            '<div class="env-meta">' + esc(sfMeta(r.s, sf.meta)) + "</div></li>";
        }).join("");
        h += '</ol><p class="env-meta">Links go to each site’s official EPA profile. <a href="superfund.html">What is Superfund?</a></p></section>';
        box.innerHTML = h;
        if (munitionsEl) munitionsEl.hidden = !state.mun;
        Array.prototype.forEach.call(box.querySelectorAll("input[data-k]"), function (cb) {
          cb.addEventListener("change", function () {
            state[cb.getAttribute("data-k")] = cb.checked;
            if (cb.getAttribute("data-k") === "deleted") { render(last.lat, last.lon, last.label); return; }
            if (munitionsEl) munitionsEl.hidden = !state.mun;
            var g = box.querySelector('[data-group="' + cb.getAttribute("data-k") + '"]');
            if (g) g.hidden = !cb.checked;
            drawMap(sfPick, pfPick);
          });
        });
        drawMap(sfPick, pfPick);
      }).catch(function (e) { box.innerHTML = '<p class="nearby-error">' + esc(e.message) + "</p>"; });
    }

    function drawMap(sfPick, pfPick) {
      map = window.DMNM_MAP || null;
      if (!map || typeof L === "undefined") return;
      if (mapLayer) map.removeLayer(mapLayer);
      mapLayer = L.layerGroup().addTo(map);
      if (state.sf) sfPick.forEach(function (r) {
        L.circleMarker([r.s.la, r.s.lo], { radius: 7, color: "#5b21b6", weight: 2, fillColor: "#ede9fe", fillOpacity: 0.9 })
          .bindPopup("<strong>Superfund:</strong> " + esc(r.s.n) + '<br><a href="' + esc(r.s.u) + '">EPA site profile</a>').addTo(mapLayer);
      });
      if (state.pfas) pfPick.forEach(function (r) {
        L.circleMarker([r.s.la, r.s.lo], { radius: 7, color: "#0e7490", weight: 2, fillColor: "#cffafe", fillOpacity: 0.9 })
          .bindPopup("<strong>Military PFAS:</strong> " + esc(r.s.n)).addTo(mapLayer);
      });
    }

    form.addEventListener("submit", function () {
      var zip = (zipInput.value || "").trim();
      if (!/^\d{5}$/.test(zip)) { box.hidden = true; return; }
      load("data/zcta-centroids.json").then(function (t) {
        var c = t[zip];
        if (!c || c.length < 2) { box.hidden = true; return; }
        render(Number(c[0]), Number(c[1]), "ZIP " + zip);
      }).catch(function () { box.hidden = true; });
    });
    if (geoBtn && navigator.geolocation) {
      geoBtn.addEventListener("click", function () {
        navigator.geolocation.getCurrentPosition(function (pos) {
          render(pos.coords.latitude, pos.coords.longitude, "your location");
        }, function () {}, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
      });
    }
    var m = /[?&]zip=(\d{5})/.exec(location.search);
    if (m && zipInput && !zipInput.value) { zipInput.value = m[1]; }
  }

  /* ---------- list pages ---------- */
  function fillStates(sel, codes) {
    Array.from(new Set(codes)).sort().forEach(function (c) { var o = document.createElement("option"); o.value = c; o.textContent = c; sel.appendChild(o); });
  }
  function pfasMode() {
    load("data/pfas.json").then(function (d) {
      var rows = d.installations, sel = document.getElementById("pfas-state"), q = document.getElementById("pfas-q");
      var tb = document.querySelector("#pfas-table tbody"), cnt = document.getElementById("pfas-count");
      fillStates(sel, rows.map(function (r) { return r.s; }));
      function draw() {
        var qq = (q.value || "").toLowerCase();
        var vis = rows.filter(function (r) { return (!sel.value || r.s === sel.value) && (!qq || (r.n + " " + r.sn + " " + r.comp).toLowerCase().indexOf(qq) !== -1); });
        cnt.textContent = "Showing " + vis.length + " of " + rows.length + " installations. Source: DoD, data as of " + d.meta.data_date + ".";
        tb.innerHTML = vis.map(function (r) {
          return "<tr><td>" + esc(r.n) + "</td><td>" + esc(r.s) + "</td><td>" + esc(r.comp + " · " + r.t) + "</td><td>" + esc(r.cs) + (r.ia ? " · Interim action listed" : "") + "</td></tr>";
        }).join("");
      }
      sel.addEventListener("change", draw); q.addEventListener("input", draw); draw();
    });
  }
  function sfMode() {
    load("data/superfund.json").then(function (d) {
      var rows = d.sites, sel = document.getElementById("sf-state"), st = document.getElementById("sf-status"), fed = document.getElementById("sf-fed"), q = document.getElementById("sf-q");
      var tb = document.querySelector("#sf-table tbody"), cnt = document.getElementById("sf-count");
      fillStates(sel, rows.map(function (r) { return r.s; }));
      function draw() {
        var qq = (q.value || "").toLowerCase();
        var vis = rows.filter(function (r) {
          return (!sel.value || r.s === sel.value) && (!st.value || r.st === st.value) && (!fed.checked || r.f) && (!qq || (r.n + " " + r.c + " " + r.id).toLowerCase().indexOf(qq) !== -1);
        });
        cnt.textContent = "Showing " + vis.length + " of " + rows.length + " sites. Source: EPA, data as of " + d.meta.data_date + ".";
        tb.innerHTML = vis.map(function (r) {
          return '<tr><td><a href="' + esc(r.u) + '">' + esc(r.n) + "</a>" + (r.f ? ' <span class="env-tag env-tag--fed">Federal</span>' : "") + "</td><td>" + esc(r.c) + "</td><td>" + esc(r.s) + "</td><td>" + esc(SF_LABEL[r.st].replace(" the Superfund list", " list").replace("On list", "On the list")) + "</td><td>" + esc(r.ld || r.pd) + "</td></tr>";
        }).join("");
      }
      [sel, st, fed].forEach(function (e) { e.addEventListener("change", draw); }); q.addEventListener("input", draw); draw();
    });
  }
  if (MODE === "pfas") pfasMode(); else if (MODE === "superfund") sfMode(); else zipMode();
})();
