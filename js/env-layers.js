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
  function u5Text(p) {
    if (!p.u5) return "";
    return "Town water systems within 5 miles, not tests on the base (EPA UCMR 5): " + p.u5 + " system" + (p.u5 === 1 ? "" : "s") +
      (p.u5d ? ", PFOA or PFOS detected in " + p.u5d : ", no PFOA or PFOS detected") +
      ((p.u5s || []).length && p.u5d ? ". " + p.u5s.filter(function (x) { return x.r !== "not detected"; }).map(function (x) { return x.n + ": " + x.r; }).join("; ") : "") + ".";
  }
  function pfPopup(p, meta) {
    var u = u5Text(p);
    return "<strong>Military PFAS:</strong> " + esc(p.n) + "<br>" + esc(p.comp + " " + p.t) + " · DoD status: " + esc(p.cs) +
      "<br><small>Base location, not the contamination location" + (p.cp === "approximate" ? " (approximate point)" : "") + ".</small>" + (u ? "<br><small>" + esc(u) + "</small>" : "");
  }

  var LM_STYLE = { radius: 7, color: "#7c2d12", weight: 2, fillColor: "#fdba74", fillOpacity: 0.95 };
  var AUM_STYLE = { radius: 5, color: "#3f3f46", weight: 1, fillColor: "#a16207", fillOpacity: 0.9 };
  function lmPopup(s) {
    return "<strong>DOE Legacy Management:</strong> " + esc(s.n) + "<br>" +
      (s.rec ? "<small>Records site in Grand Junction, Colorado, not a contamination site.</small><br>" : (s.dl ? esc(s.dl) + "<br>" : "")) +
      '<a href="' + esc(s.u) + '">DOE site page</a>' + (s.fs ? ' · <a href="' + esc(s.fs) + '">fact sheet</a>' : "");
  }
  function aumPopup(s) {
    return "<strong>Abandoned uranium mine:</strong> " + esc(s.n) + " (EPA ID " + esc(s.mid) + ")<br>" + esc(s.reg) + " AUM region, Navajo Nation area · " + esc(s.st) +
      '<br><a href="' + esc(s.fs || s.u) + '">' + (s.fs ? "EPA screening report" : "EPA program page") + "</a>";
  }
  function clusterGroup() {
    return (typeof L.markerClusterGroup === "function") ? L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45, chunkedLoading: true }) : L.layerGroup();
  }

  /* FUDS helpers: polygon distance in miles (local flat projection), "inside" = 0 */
  var FUDS_STYLE = { radius: 6, color: "#4a044e", weight: 2, fillColor: "#e879f9", fillOpacity: 0.9 };
  var MRS_STYLE = { color: "#86198f", weight: 2, fillColor: "#f0abfc", fillOpacity: 0.25 };
  var MRSPP = { "01": "Priority 1 (highest potential hazard)", "02": "Priority 2", "03": "Priority 3", "04": "Priority 4", "05": "Priority 5", "06": "Priority 6", "07": "Priority 7",
    "08": "Priority 8 (lowest potential hazard)", "09": "Evaluation pending", "10": "No longer required (response done)", "11": "No known or suspected hazard" };
  function mrsppTxt(c) { return c ? "MRSPP " + (MRSPP[c] || c) : "no MRSPP value"; }
  function ringsOf(g) { return g.type === "Polygon" ? [g.coordinates] : g.coordinates; }
  function polyMiles(lat, lon, g) {
    var k = Math.cos(lat * Math.PI / 180) * 69.17, best = Infinity, inside = false;
    ringsOf(g).forEach(function (poly) {
      var inPoly = false;
      poly.forEach(function (ring, ri) {
        var inRing = false;
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          var xi = (ring[i][0] - lon) * k, yi = (ring[i][1] - lat) * 69.17, xj = (ring[j][0] - lon) * k, yj = (ring[j][1] - lat) * 69.17;
          if ((yi > 0) !== (yj > 0) && 0 < (xj - xi) * (0 - yi) / (yj - yi) + xi) inRing = !inRing;
          var dx = xj - xi, dy = yj - yi, L2 = dx * dx + dy * dy, tt = L2 ? Math.max(0, Math.min(1, -(xi * dx + yi * dy) / L2)) : 0;
          var px = xi + tt * dx, py = yi + tt * dy, d = Math.sqrt(px * px + py * py);
          if (d < best) best = d;
        }
        if (ri === 0) inPoly = inRing; else if (inRing) inPoly = false;
      });
      if (inPoly) inside = true;
    });
    return inside ? 0 : best;
  }
  var FUDSO_STYLE = { radius: 5, color: "#44403c", weight: 1, fillColor: "#d6d3d1", fillOpacity: 0.9 };
  var FUDS_CAT = { "MMRP": "munitions response", "MMRP/CWM": "munitions response (chemical warfare materiel)", "PRP/MMRP": "munitions response (another party responsible)",
    "HTRW": "hazardous, toxic or radioactive waste", "CON/HTRW": "containerized waste (tanks, drums, pipelines)", "BD/DR": "building demolition / debris removal", "PRP/HTRW": "hazardous waste (another party responsible)" };
  function fudsKind(x) { return x.k === "m" ? "FUDS munitions" : (x.k === "o" ? "Other FUDS (other cleanup projects)" : "Other FUDS (no projects)"); }
  function fudsDetail(x) {
    if (x.k === "m") return x.m.length ? x.m.map(function (m) { return m[0] + " (" + mrsppTxt(m[1]) + ")"; }).join("; ") : (x.rv.length ? x.rv.map(mrsppTxt).join(", ") + " · no mapped boundary" : "No mapped boundary");
    if (x.k === "o") return x.cat.length ? x.cat.map(function (c) { return FUDS_CAT[c] || c; }).join("; ") : "Projects listed; no FY24 project details";
    return "No projects" + (x.el ? " · FUDS eligibility: " + x.el : "");
  }
  function fudsPopup(x) {
    return "<strong>" + esc(fudsKind(x)) + ":</strong> " + esc(x.n) + "<br>" + esc((x.co ? x.co + " County, " : "") + x.s) +
      "<br>" + esc(fudsDetail(x)) + (x.done ? "<br>All projects closed out" : "") + (x.u ? '<br><a href="' + esc(x.u) + '">USACE FUDS record</a>' : "");
  }
  var fudsPropsCache = {};
  function loadFudsProps(base, st) {
    st = (st || "").toLowerCase();
    if (!fudsPropsCache[st]) fudsPropsCache[st] = load(base + "data/fuds/props-" + st + ".json").catch(function () { return { props: [] }; });
    return fudsPropsCache[st];
  }
  function mrsPopup(p) {
    return "<strong>Munitions response site:</strong> " + esc(p.n) + "<br>Property: " + esc(p.p) + (p.co ? "<br>" + esc(p.co) + " County" : "") +
      "<br>" + esc(mrsppTxt(p.rv)) + (p.ps ? " · " + esc(p.ps) : "") + "<br><small>Simplified boundary, not survey-grade.</small>";
  }
  var fudsStateCache = {};
  function loadFudsState(base, st) {
    st = (st || "").toLowerCase();
    if (!fudsStateCache[st]) fudsStateCache[st] = load(base + "data/fuds/mrs-" + st + ".json").catch(function () { return { features: [] }; });
    return fudsStateCache[st];
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
    var state = { mun: true, pfas: true, sf: true, fus: true, lm: true, aum: true, fuds: true, fudso: true, deleted: false };

    function filtersHtml() {
      return '<fieldset class="env-filter-set"><legend>Show these site types</legend>' +
        '<label class="env-check"><input type="checkbox" data-k="mun"' + (state.mun ? " checked" : "") + '> <span class="env-tag env-tag--mun">Munitions</span></label>' +
        '<label class="env-check"><input type="checkbox" data-k="pfas"' + (state.pfas ? " checked" : "") + '> <span class="env-tag env-tag--pfas">Military PFAS</span></label>' +
        '<label class="env-check"><input type="checkbox" data-k="sf"' + (state.sf ? " checked" : "") + '> <span class="env-tag env-tag--sf">Superfund</span></label>' +
        '<label class="env-check"><input type="checkbox" data-k="fus"' + (state.fus ? " checked" : "") + '> <span class="env-tag env-tag--fus">FUSRAP</span></label>' +
        '<label class="env-check"><input type="checkbox" data-k="lm"' + (state.lm ? " checked" : "") + '> <span class="env-tag env-tag--lm">DOE Legacy Management</span></label>' +
        '<label class="env-check"><input type="checkbox" data-k="aum"' + (state.aum ? " checked" : "") + '> <span class="env-tag env-tag--aum">Navajo uranium mines</span></label>' +
        '<label class="env-check"><input type="checkbox" data-k="fuds"' + (state.fuds ? " checked" : "") + '> <span class="env-tag env-tag--fuds">FUDS munitions</span></label>' +
        '<label class="env-check"><input type="checkbox" data-k="fudso"' + (state.fudso ? " checked" : "") + '> <span class="env-tag env-tag--fudso">Other FUDS</span></label>' +
        '<label class="env-check"><input type="checkbox" data-k="deleted"' + (state.deleted ? " checked" : "") + '> Include deleted (cleaned-up) Superfund sites</label></fieldset>' +
        (window.DMNM_MAP ? '<p class="env-legend" aria-label="Map marker key"><span><i class="env-dot env-dot--sf" aria-hidden="true"></i> Superfund</span> <span><i class="env-dot env-dot--fus" aria-hidden="true"></i> FUSRAP</span> <span><i class="env-dot env-dot--pfas" aria-hidden="true"></i> Military PFAS (base location)</span> <span><i class="env-dot env-dot--lm" aria-hidden="true"></i> DOE LM</span> <span><i class="env-dot env-dot--aum" aria-hidden="true"></i> Uranium mine</span> <span><i class="env-dot env-dot--fuds" aria-hidden="true"></i> FUDS munitions</span> <span><i class="env-dot env-dot--fudso" aria-hidden="true"></i> Other FUDS</span> <span><i class="env-dot env-dot--zip" aria-hidden="true"></i> Your ZIP</span><span><i class="env-dot env-dot--mun" aria-hidden="true"></i> Munitions (green, amber or gray)</span></p>' : "");
    }

    function render(lat, lon, label) {
      last = { lat: lat, lon: lon, label: label };
      box.hidden = false;
      box.innerHTML = "<p>Loading PFAS and Superfund layers…</p>";
      Promise.all([load("data/superfund.json"), load("data/pfas.json"), load("data/fusrap.json"), load("data/nuclear.json"), load("data/fuds/pts.json")]).then(function (res) {
        var sf = res[0], pf = res[1], fu = res[2], nu = res[3], fp = res[4]; pf_meta = pf.meta;
        var near = [], sts = {};
        Object.keys(fp.pts).forEach(function (s) { fp.pts[s].forEach(function (q) { var d = miles(lat, lon, q[0], q[1]); if (d <= (q[2] === 1 ? 130 : 50)) { near.push({ st: s, q: q, d: d }); sts[s] = (sts[s] || 0) | (q[2] === 1 ? 2 : 1); } }); });
        var stList = Object.keys(sts);
        return Promise.all(stList.map(function (s) { return loadFudsProps("", s); }).concat(stList.map(function (s) { return (sts[s] & 2) ? loadFudsState("", s) : Promise.resolve({ features: [] }); }))).then(function (files) {
          var byPn = {}, propsBy = {};
          stList.forEach(function (s, i) { propsBy[s] = files[i].props; });
          files.slice(stList.length).forEach(function (fc) { fc.features.forEach(function (f) { (byPn[f.properties.pn] = byPn[f.properties.pn] || []).push(f); }); });
          var fdNear = near.filter(function (n) { return n.q[2] === 1; }).map(function (n) { return { s: propsBy[n.st][n.q[3]], mi: n.d }; });
          var fdOther = near.filter(function (n) { return n.q[2] !== 1; }).map(function (n) { return { s: propsBy[n.st][n.q[3]], mi: n.d }; }).sort(function (a, b) { return a.mi - b.mi; });
          var fd = { other: fdOther };
          fdNear.forEach(function (r) {
            r.pt = r.mi; r.inside = false; r.feats = byPn[r.s.pn] || [];
            r.feats.forEach(function (f) { var d = polyMiles(lat, lon, f.geometry); if (d === 0) r.inside = true; if (d < r.mi) { r.mi = d; r.byPoly = true; } });
          });
          fdNear.sort(function (a, b) { return a.mi - b.mi; });
          return [sf, pf, fu, nu, fd, fdNear.filter(function (r, i) { return r.mi <= 50 && i < 8; }), fdNear.filter(function (r) { return r.mi <= 50; }).length];
        });
      }).then(function (res) {
        var sf = res[0], pf = res[1], fu = res[2], nu = res[3], fd = res[4], fdPick = res[5], fdCount = res[6];
        var lmRanked = nu.lm.filter(function (s) { return !s.rec; }).map(function (s) { return { s: s, mi: miles(lat, lon, s.la, s.lo) }; }).sort(function (a, b) { return a.mi - b.mi; });
        var lmPick = lmRanked.filter(function (r, i) { return i < 3 || (r.mi <= 50 && i < 10); });
        var aumIn = nu.aum.map(function (s) { return { s: s, mi: miles(lat, lon, s.la, s.lo) }; }).filter(function (r) { return r.mi <= 50; }).sort(function (a, b) { return a.mi - b.mi; });
        var aumPick = aumIn.slice(0, 10);
        var fuRanked = fu.sites.filter(function (s) { return s.la != null && s.lo != null; })
          .map(function (s) { return { s: s, mi: miles(lat, lon, s.la, s.lo) }; })
          .sort(function (a, b) { return a.mi - b.mi; });
        var fuPick = fuRanked.filter(function (r, i) { return i < 3 || (r.mi <= 100 && i < 10); });
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
              '<div class="env-meta">' + esc(pfMeta(r.s, pf.meta)) + "</div>" + (r.s.u5 ? '<div class="env-meta">' + esc(u5Text(r.s)) + "</div>" : "") + "</li>";
          }).join("") + "</ol>";
        }
        if (pf.meta.geocoded < pf.meta.count) {
          h += '<p class="env-meta">' + pf.meta.geocoded + " of " + pf.meta.count +
            " installations DoD is checking for PFAS have a checked map point (checked Nov 25, 2026), so distances cover those only. Points are base locations, not contamination locations." +
            ' The rest are in the <a href="pfas.html#pfas-list-heading">full list by state</a> (DoD data as of ' + esc(pf.meta.data_date) + ").</p>";
        }
        h += "</section>";
        h += '<section class="env-group" data-group="sf"' + (state.sf ? "" : " hidden") + '><h3><span class="env-tag env-tag--sf">Superfund</span> Nearest Superfund (NPL) sites</h3><ol>';
        h += sfPick.map(function (r) {
          return '<li><a href="' + esc(r.s.u) + '">' + esc(r.s.n) + "</a> — <span class=\"miles\">" + fmt(r.mi) + "</span> — " + esc([r.s.c, r.s.s].filter(Boolean).join(", ")) +
            '<div class="env-meta">' + esc(sfMeta(r.s, sf.meta)) + "</div></li>";
        }).join("");
        h += '</ol><p class="env-meta">Links go to each site’s official EPA profile. <a href="superfund.html">What is Superfund?</a></p></section>';
        h += '<section class="env-group" data-group="fus"' + (state.fus ? "" : " hidden") + '><h3><span class="env-tag env-tag--fus">FUSRAP</span> Nearest active FUSRAP (atomic-era cleanup) sites</h3><ol>';
        h += fuPick.map(function (r) {
          return '<li><a href="' + esc(r.s.u) + '">' + esc(r.s.n) + "</a> — <span class=\"miles\">" + fmt(r.mi) + "</span> — " + esc([r.s.c, r.s.s].filter(Boolean).join(", ")) +
            '<div class="env-meta">' + esc(r.s.ph + " · USACE " + r.s.dist + " · Checked against USACE, DOE LM and EPA records on Nov 25, 2026") + "</div></li>";
        }).join("");
        h += '</ol><p class="env-meta">' + fu.meta.unmapped.length + ' of the ' + fu.meta.count + ' active sites are marked “location not confirmed” and are not included in distances. See all on the <a href="fusrap.html">FUSRAP page</a>.</p></section>';
        h += '<section class="env-group" data-group="fuds"' + (state.fuds ? "" : " hidden") + '><h3><span class="env-tag env-tag--fuds">FUDS munitions</span> Formerly Used Defense Sites with munitions within 50 miles</h3>';
        if (fdPick.length) {
          h += "<p>" + fdCount + " propert" + (fdCount === 1 ? "y" : "ies") + " within 50 miles" + (fdCount > fdPick.length ? "; the nearest " + fdPick.length + " are listed" : "") + ".</p><ol>";
          h += fdPick.map(function (r) {
            var where = r.inside ? "<strong>inside a mapped munitions response area</strong>" : '<span class="miles">' + fmt(r.mi) + "</span>" + (r.byPoly ? " to the nearest mapped boundary" : " to the property point");
            return '<li><a href="' + esc(r.s.u) + '">' + esc(r.s.n) + "</a> — " + where + " — " + esc((r.s.co ? r.s.co + " County, " : "") + r.s.s) +
              '<div class="env-meta">' + esc(r.s.m.length ? r.s.m.map(function (m) { return m[0] + " (" + mrsppTxt(m[1]) + ")"; }).join("; ") : (r.s.rv.length ? r.s.rv.map(mrsppTxt).join(", ") + " · no mapped boundary" : "No mapped boundary")) + (r.s.done ? " · all projects closed out" : "") + "</div></li>";
          }).join("") + "</ol>";
        } else {
          h += "<p>None within 50 miles.</p>";
        }
        h += '<p class="env-meta">Source: USACE FUDS GIS (FY24), checked Nov 25, 2026. MRSPP runs from 1 (highest potential hazard) to 8 (lowest); <a href="fuds.html#mrspp">what it means</a>. If you find a possible munition: Recognize, Retreat, Report (call 911).</p></section>';
        var fo = fd.other, foPick = fo.slice(0, 5);
        h += '<section class="env-group" data-group="fudso"' + (state.fudso ? "" : " hidden") + '><h3><span class="env-tag env-tag--fudso">Other FUDS</span> Other Formerly Used Defense Sites within 50 miles</h3>';
        if (fo.length) {
          h += "<p>" + fo.length + " propert" + (fo.length === 1 ? "y" : "ies") + " without a munitions project within 50 miles (" + fo.filter(function (r) { return r.s.k === "o"; }).length + " with other cleanup projects)" + (fo.length > 5 ? "; the nearest 5 are listed" : "") + ".</p><ol>";
          h += foPick.map(function (r) {
            return '<li>' + (r.s.u ? '<a href="' + esc(r.s.u) + '">' + esc(r.s.n) + "</a>" : esc(r.s.n)) + ' — <span class="miles">' + fmt(r.mi) + "</span>" +
              '<div class="env-meta">' + esc(fudsKind(r.s) + " · " + fudsDetail(r.s) + (r.s.done ? " · all projects closed out" : "")) + "</div></li>";
          }).join("") + "</ol>";
        } else { h += "<p>None within 50 miles.</p>"; }
        h += '<p class="env-meta">Other hazards include hazardous waste, containerized waste and building debris. <a href="fuds.html">About FUDS</a></p></section>';
        h += '<section class="env-group" data-group="lm"' + (state.lm ? "" : " hidden") + '><h3><span class="env-tag env-tag--lm">DOE LM</span> Nearest DOE Legacy Management sites</h3><ol>';
        h += lmPick.map(function (r) {
          return '<li><a href="' + esc(r.s.u) + '">' + esc(r.s.n) + "</a> — <span class=\"miles\">" + fmt(r.mi) + "</span>" +
            '<div class="env-meta">' + esc((r.s.dl || "DOE LM site") + (r.s.ty ? " · with DOE LM since " + r.s.ty : "") + " · Source: DOE Office of Legacy Management, checked Nov 25, 2026") + "</div></li>";
        }).join("");
        h += '</ol><p class="env-meta">Long-term care sites; being listed does not by itself mean a place is unsafe today. <a href="nuclear-legacy.html#lm">About DOE LM sites</a></p></section>';
        h += '<section class="env-group" data-group="aum"' + (state.aum ? "" : " hidden") + '><h3><span class="env-tag env-tag--aum">Uranium mines</span> Navajo Nation abandoned uranium mines within 50 miles</h3>';
        if (aumIn.length) {
          h += "<p>" + aumIn.length + " mine" + (aumIn.length === 1 ? "" : "s") + " in EPA’s Navajo Nation inventory " + (aumIn.length === 1 ? "is" : "are") + " within 50 miles" + (aumIn.length > aumPick.length ? "; the nearest " + aumPick.length + " are listed" : "") + ".</p><ol>";
          h += aumPick.map(function (r) {
            return '<li><a href="' + esc(r.s.fs || r.s.u) + '">' + esc(r.s.n) + "</a> — <span class=\"miles\">" + fmt(r.mi) + "</span>" +
              '<div class="env-meta">' + esc("EPA ID " + r.s.mid + " · " + r.s.reg + " AUM region · " + r.s.st) + "</div></li>";
          }).join("") + "</ol>";
        } else {
          h += "<p>None within 50 miles.</p>";
        }
        h += '<p class="env-meta">Source: EPA Region 9, checked Nov 25, 2026. See EPA’s <a href="https://www.epa.gov/navajo-nation-uranium-cleanup/what-are-health-effects-uranium">health guidance</a> and <a href="nuclear-legacy.html#navajo">about these mines</a>.</p></section>';
        box.innerHTML = h;
        if (munitionsEl) munitionsEl.hidden = !state.mun;
        Array.prototype.forEach.call(box.querySelectorAll("input[data-k]"), function (cb) {
          cb.addEventListener("change", function () {
            state[cb.getAttribute("data-k")] = cb.checked;
            if (cb.getAttribute("data-k") === "deleted") { render(last.lat, last.lon, last.label); return; }
            if (munitionsEl) munitionsEl.hidden = !state.mun;
            var g = box.querySelector('[data-group="' + cb.getAttribute("data-k") + '"]');
            if (g) g.hidden = !cb.checked;
            drawMap(sfPick, pfPick, fuPick, lmPick, aumPick, fdPick, foPick);
          });
        });
        drawMap(sfPick, pfPick, fuPick, lmPick, aumPick, fdPick, foPick);
      }).catch(function (e) { box.innerHTML = '<p class="nearby-error">' + esc(e.message) + "</p>"; });
    }

    var pf_meta = null;
    function drawMap(sfPick, pfPick, fuPick, lmPick, aumPick, fdPick, foPick) {
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
          .bindPopup(pfPopup(r.s, pf_meta)).addTo(mapLayer);
      });
      if (state.fuds) (fdPick || []).forEach(function (r) {
        (r.feats || []).forEach(function (f) { L.geoJSON(f.geometry, { style: MRS_STYLE }).bindPopup(mrsPopup(f.properties)).addTo(mapLayer); });
        L.circleMarker([r.s.la, r.s.lo], FUDS_STYLE).bindPopup(fudsPopup(r.s)).addTo(mapLayer);
      });
      if (state.fudso) (foPick || []).forEach(function (r) { L.circleMarker([r.s.la, r.s.lo], FUDSO_STYLE).bindPopup(fudsPopup(r.s)).addTo(mapLayer); });
      if (state.lm) (lmPick || []).forEach(function (r) { L.circleMarker([r.s.la, r.s.lo], LM_STYLE).bindPopup(lmPopup(r.s)).addTo(mapLayer); });
      if (state.aum) (aumPick || []).forEach(function (r) { L.circleMarker([r.s.la, r.s.lo], AUM_STYLE).bindPopup(aumPopup(r.s)).addTo(mapLayer); });
      if (state.fus) (fuPick || []).forEach(function (r) {
        L.circleMarker([r.s.la, r.s.lo], { radius: 8, color: "#854d0e", weight: 3, fillColor: "#fde047", fillOpacity: 0.95 })
          .bindPopup("<strong>FUSRAP:</strong> " + esc(r.s.n) + '<br><a href="' + esc(r.s.u) + '">USACE site page</a>').addTo(mapLayer);
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
      var el = document.getElementById("map"), pmap = null, layer = null;
      if (el && typeof L !== "undefined") {
        pmap = L.map(el, { scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(pmap);
        pmap.setView([39.5, -98.35], 3);
      }
      function drawPf(vis) {
        if (!pmap) return;
        if (layer) pmap.removeLayer(layer);
        layer = L.layerGroup().addTo(pmap);
        var pts = [];
        vis.forEach(function (r) { if (r.la == null) return; pts.push([r.la, r.lo]);
          L.circleMarker([r.la, r.lo], { radius: 6, color: "#0e7490", weight: 2, fillColor: r.u5d ? "#0891b2" : "#cffafe", fillOpacity: 0.9 }).bindPopup(pfPopup(r, d.meta)).addTo(layer); });
        if (pts.length) pmap.fitBounds(pts, { padding: [20, 20], maxZoom: 9 });
      }
      function draw() {
        var qq = (q.value || "").toLowerCase();
        var vis = rows.filter(function (r) { return (!sel.value || r.s === sel.value) && (!qq || (r.n + " " + r.sn + " " + r.comp).toLowerCase().indexOf(qq) !== -1); });
        cnt.textContent = "Showing " + vis.length + " of " + rows.length + " installations (" + vis.filter(function (r) { return r.la != null; }).length + " mapped). Source: DoD, data as of " + d.meta.data_date + ".";
        drawPf(vis);
        tb.innerHTML = vis.map(function (r) {
          return "<tr><td>" + esc(r.n) + "</td><td>" + esc(r.s) + "</td><td>" + esc(r.comp + " · " + r.t) + "</td><td>" + esc(r.cs) + (r.ia ? " · Interim action listed" : "") + "</td><td>" +
            (r.la != null ? "Mapped" + (r.cp === "approximate" ? " (approximate)" : "") : "List only") + "</td><td>" +
            (r.la == null ? "Not checked (no map point)" : r.u5 ? esc(r.u5 + " system" + (r.u5 === 1 ? "" : "s") + "; " + (r.u5d ? "PFOA/PFOS detected in " + r.u5d : "none detected")) : "No system within 5 miles") + "</td></tr>";
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
  function fusMode() {
    load("data/fusrap.json").then(function (d) {
      var tb = document.querySelector("#fusrap-table tbody"), cnt = document.getElementById("fusrap-count");
      cnt.textContent = d.meta.count + " active sites, " + d.meta.mapped + " mapped; " + d.meta.unmapped.length + " location not confirmed. Checked against USACE, DOE LM and EPA records on Nov 25, 2026.";
      tb.innerHTML = d.sites.map(function (r) {
        return '<tr><td><a href="' + esc(r.u) + '">' + esc(r.n) + "</a></td><td>" + esc([r.c, r.s].filter(Boolean).join(", ")) + "</td><td>" + esc(r.ph) + "</td><td>" + esc(r.cont.split(/[(;]/)[0].trim()) + "</td><td>" + esc(r.dist + (r.ty ? " / FY " + r.ty : "")) + "</td><td>" + (r.la != null ? "Mapped" + (r.cp === "approximate" ? " (approximate)" : "") : "Location not confirmed") + "</td></tr>";
      }).join("");
    });
  }
  function seaPopup(s) {
    return "<strong>Sea dump " + esc(s.code) + ":</strong> " + esc(s.n) + "<br>" + esc(s.mi) + " nautical miles from shore · depth " + esc(s.dp) + " feet" +
      "<br><small>Approximate location: the charted Unexploded Ordnance area on NOAA chart 19357.</small>";
  }
  function seaMode() {
    load("data/seadump.json").then(function (d) {
      var rows = d.sites, sel = document.getElementById("sea-state"), chem = document.getElementById("sea-chem");
      var tb = document.querySelector("#sea-table tbody"), cnt = document.getElementById("sea-count");
      var names = {};
      rows.forEach(function (r) { if (r.s) names[r.s] = r.sn; });
      Object.keys(names).sort(function (a, b) { return names[a] < names[b] ? -1 : 1; }).forEach(function (c) { var o = document.createElement("option"); o.value = c; o.textContent = names[c]; sel.appendChild(o); });
      var o2 = document.createElement("option"); o2.value = "-"; o2.textContent = "Not named by DoD"; sel.appendChild(o2);
      var el = document.getElementById("map");
      if (el && typeof L !== "undefined") {
        var map = L.map(el, { scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(map);
        var pts = [];
        rows.forEach(function (r) { if (r.la == null) return; pts.push([r.la, r.lo]);
          L.circleMarker([r.la, r.lo], { radius: 9, color: "#1e3a8a", weight: 3, fillColor: "#1d4ed8", fillOpacity: 0.85 }).bindPopup(seaPopup(r)).addTo(map); });
        if (pts.length) map.setView(pts[0], 10); else map.setView([39.5, -98.35], 3);
      }
      function draw() {
        var vis = rows.filter(function (r) { return (!sel.value || (sel.value === "-" ? !r.s : r.s === sel.value)) && (!chem.checked || r.cwc); });
        cnt.textContent = "Showing " + vis.length + " of " + rows.length + " sites (" + vis.filter(function (r) { return r.cwc; }).length + " with chemical weapons). Source: DoD FY2009 report, checked Nov 25, 2026.";
        tb.innerHTML = vis.map(function (r) {
          var what = (r.cwc ? "<strong>Chemical weapons</strong>" + (r.ag.length ? ": " + esc(r.ag.join(", ")) : "") + ". " : "") + esc(r.it.join("; ")) + (r.nit > r.it.length ? " and " + (r.nit - r.it.length) + " more rows" : "");
          return "<tr><td>" + esc(r.n) + "</td><td>" + esc(r.sn || "Not named") + "</td><td>" + esc(r.mi) + "</td><td>" + esc(r.dp) + "</td><td>" + what + "</td><td>" +
            (r.la != null ? "Mapped (approximate)" : "List only") + "</td></tr>";
        }).join("");
      }
      sel.addEventListener("change", draw); chem.addEventListener("change", draw); draw();
    });
  }
  function nuclearMode() {
    load("data/nuclear.json").then(function (d) {
      var el = document.getElementById("map"), map = null, gLm = null, gAum = null;
      if (el && typeof L !== "undefined") {
        map = L.map(el, { scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(map);
        map.setView([38.5, -98.5], 4);
        gLm = L.layerGroup(); d.lm.forEach(function (s) { L.circleMarker([s.la, s.lo], LM_STYLE).bindPopup(lmPopup(s)).addTo(gLm); }); gLm.addTo(map);
        gAum = clusterGroup(); d.aum.forEach(function (s) { gAum.addLayer(L.circleMarker([s.la, s.lo], AUM_STYLE).bindPopup(aumPopup(s))); }); map.addLayer(gAum);
        map.fitBounds(d.lm.filter(function (s) { return s.lo < -60 && s.lo > -130 && s.la < 50; }).map(function (s) { return [s.la, s.lo]; }), { padding: [16, 16] });
        [["nuc-show-lm", gLm], ["nuc-show-aum", gAum]].forEach(function (p) {
          var cb = document.getElementById(p[0]); if (!cb) return;
          cb.addEventListener("change", function () { if (cb.checked) map.addLayer(p[1]); else map.removeLayer(p[1]); });
        });
      }
      var ls = document.getElementById("lm-state"), ltb = document.querySelector("#lm-table tbody"), lc = document.getElementById("lm-count");
      fillStates(ls, d.lm.map(function (r) { return r.s; }));
      function drawLm() {
        var vis = d.lm.filter(function (r) { return !ls.value || r.s === ls.value; });
        lc.textContent = "Showing " + vis.length + " of " + d.lm.length + " DOE LM sites.";
        ltb.innerHTML = vis.map(function (r) {
          return "<tr><td>" + esc(r.n) + "</td><td>" + esc(r.s) + "</td><td>" + (r.rec ? "<strong>Records site</strong> in Grand Junction, not a contamination site" : esc(r.dl || "DOE LM site")) + "</td><td>" + esc(r.ty) + "</td><td>" +
            '<a href="' + esc(r.u) + '">site page</a>' + (r.fs ? ' · <a href="' + esc(r.fs) + '">fact sheet</a>' : "") + "</td></tr>";
        }).join("");
      }
      ls.addEventListener("change", drawLm); drawLm();
      var rg = document.getElementById("aum-region"), pr = document.getElementById("aum-pr"), q = document.getElementById("aum-q");
      var atb = document.querySelector("#aum-table tbody"), ac = document.getElementById("aum-count");
      Array.from(new Set(d.aum.map(function (r) { return r.reg; }))).filter(Boolean).sort().forEach(function (v) { var o = document.createElement("option"); o.value = v; o.textContent = v; rg.appendChild(o); });
      function drawAum() {
        var qq = (q.value || "").toLowerCase();
        var vis = d.aum.filter(function (r) { return (!rg.value || r.reg === rg.value) && (!pr.checked || r.pr) && (!qq || (r.n + " " + r.mid).toLowerCase().indexOf(qq) !== -1); });
        ac.textContent = "Showing " + vis.length + " of " + d.aum.length + " mines (" + vis.filter(function (r) { return r.pr; }).length + " priority). Source: EPA Region 9, checked Nov 25, 2026.";
        atb.innerHTML = vis.map(function (r) {
          return "<tr><td>" + esc(r.n) + "</td><td>" + esc(r.mid) + "</td><td>" + esc(r.reg) + "</td><td>" + esc(r.s) + "</td><td>" + esc(r.st) + "</td><td>" +
            (r.fs ? '<a href="' + esc(r.fs) + '">screening report</a>' : '<a href="' + esc(r.u) + '">program page</a>') + "</td></tr>";
        }).join("");
      }
      [rg, pr].forEach(function (e) { e.addEventListener("change", drawAum); }); q.addEventListener("input", drawAum); drawAum();
    });
  }
  function fudsMode() {
    load("data/fuds/pts.json").then(function (d) {
      var el = document.getElementById("map"), status = document.getElementById("fuds-map-status");
      var idx = null;
      load("data/fuds/index.json").then(function (x) { idx = x.states; fillStates(document.getElementById("fuds-state"), Object.keys(idx).filter(function (s) { return idx[s].props; })); maybeLoad(); });
      var map = null, loaded = {};
      function maybeLoad() {
        if (!map || !idx) return;
        if (map.getZoom() < 7) { status.textContent = "Zoom in to see munitions response site boundaries."; return; }
        var b = map.getBounds(), need = Object.keys(idx).filter(function (s) { var bb = idx[s].bbox; return idx[s].mrs && !loaded[s] && !(bb[2] < b.getSouth() || bb[0] > b.getNorth() || bb[3] < b.getWest() || bb[1] > b.getEast()); });
        if (!need.length) { status.textContent = "Showing munitions response site boundaries for this area."; return; }
        status.textContent = "Loading boundaries…";
        need.forEach(function (s) { loaded[s] = 1; });
        Promise.all(need.map(function (s) { return loadFudsState("", s); })).then(function (files) {
          files.forEach(function (fc) { L.geoJSON(fc, { style: MRS_STYLE, onEachFeature: function (f, l) { l.bindPopup(mrsPopup(f.properties)); } }).addTo(map); });
          status.textContent = "Showing munitions response site boundaries for this area.";
        });
      }
      if (el && typeof L !== "undefined") {
        map = L.map(el, { scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(map);
        map.setView([39, -98.5], 4);
        var gm = clusterGroup(), go = clusterGroup();
        Object.keys(d.pts).forEach(function (s) {
          d.pts[s].forEach(function (q) {
            var mk = L.circleMarker([q[0], q[1]], q[2] === 1 ? FUDS_STYLE : FUDSO_STYLE);
            mk.bindPopup("Loading…");
            mk.on("click", function () { loadFudsProps("", s).then(function (pd) { mk.setPopupContent(fudsPopup(pd.props[q[3]])); }); });
            (q[2] === 1 ? gm : go).addLayer(mk);
          });
        });
        map.addLayer(gm);
        [["fuds-show-m", gm], ["fuds-show-o", go]].forEach(function (p) {
          var cb = document.getElementById(p[0]); if (!cb) return;
          if (cb.checked && !map.hasLayer(p[1])) map.addLayer(p[1]);
          cb.addEventListener("change", function () { if (cb.checked) map.addLayer(p[1]); else map.removeLayer(p[1]); });
        });
        map.on("moveend", maybeLoad);
      }
      var sel = document.getElementById("fuds-state"), ty = document.getElementById("fuds-type"), q = document.getElementById("fuds-q"), tb = document.querySelector("#fuds-table tbody"), cnt = document.getElementById("fuds-count");
      function draw() {
        if (!sel.value) { cnt.textContent = d.meta.properties.toLocaleString() + " properties (" + d.meta.mmrp.toLocaleString() + " with munitions response projects). Choose a state to list them."; tb.innerHTML = ""; return; }
        loadFudsProps("", sel.value).then(function (pd) {
          var qq = (q.value || "").toLowerCase();
          var vis = pd.props.filter(function (x) { return (!ty.value || x.k === ty.value) && (!qq || (x.n + " " + x.co + " " + (x.m || []).map(function (m) { return m[0]; }).join(" ")).toLowerCase().indexOf(qq) !== -1); });
          vis.sort(function (a, b) { return (a.k === "m" ? 0 : 1) - (b.k === "m" ? 0 : 1) || a.n.localeCompare(b.n, "en", { sensitivity: "base" }); });
          cnt.textContent = "Showing " + Math.min(vis.length, 400) + " of " + vis.length + " matching properties in " + sel.value + ". Source: USACE FUDS GIS (FY24), checked Nov 25, 2026.";
          tb.innerHTML = vis.slice(0, 400).map(function (x) {
            return "<tr><td>" + esc(x.n) + "</td><td>" + esc(x.co) + '</td><td><span class="env-tag ' + (x.k === "m" ? "env-tag--fuds" : "env-tag--fudso") + '">' + (x.k === "m" ? "FUDS munitions" : "Other FUDS") + "</span></td><td>" +
              esc(fudsDetail(x)) + (x.done ? " · all projects closed out" : "") + "</td><td>" + (x.la != null ? "Mapped" : (x.warn ? "<strong>Caution:</strong> " + esc(x.warn) : "List only")) + "</td><td>" +
              (x.u ? '<a href="' + esc(x.u) + '">record</a>' : "") + "</td></tr>";
          }).join("");
        });
      }
      [sel, ty].forEach(function (e) { e.addEventListener("change", draw); }); q.addEventListener("input", draw); draw();
    });
  }
  function stateMode() {
    var code = script.getAttribute("data-state"), base = script.getAttribute("data-base") || "";
    Array.prototype.forEach.call(document.querySelectorAll("details.fuds-other"), function (dt) {
      dt.addEventListener("toggle", function () {
        if (!dt.open || dt.getAttribute("data-loaded")) return;
        dt.setAttribute("data-loaded", "1");
        loadFudsProps(base, code).then(function (d) {
          var rows = d.props.filter(function (x) { return x.k !== "m"; }).sort(function (a, b) { return a.n.localeCompare(b.n, "en", { sensitivity: "base" }); });
          dt.querySelector(".fuds-other-list").innerHTML = "<ul>" + rows.map(function (x) {
            return "<li>" + (x.u ? '<a href="' + esc(x.u) + '">' + esc(x.n) + "</a>" : esc(x.n)) + ' <span class="env-meta">· ' + esc((x.co ? x.co + " County · " : "") + fudsDetail(x) + (x.done ? " · all projects closed out" : "") + (x.la == null ? (x.warn ? " · Caution: " + x.warn : " · list only, no official map point") : "")) + "</span></li>";
          }).join("") + "</ul>";
        });
      });
    });
    var el = document.getElementById("map");
    if (!el || typeof L === "undefined") return;
    var map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(map);
    Promise.all([load(base + "data/sites.json"), load(base + "data/superfund.json"), load(base + "data/fusrap.json"), load(base + "data/pfas.json"), load(base + "data/seadump.json"), load(base + "data/nuclear.json"), loadFudsProps(base, code), loadFudsState(base, code)]).then(function (r) {
      var pts = [];
      function add(lat, lon, opt, html) { if (lat == null || lon == null || lat === "" || lon === "") return; lat = Number(lat); lon = Number(lon); L.circleMarker([lat, lon], opt).bindPopup(html).addTo(map); pts.push([lat, lon]); }
      r[1].sites.forEach(function (s) { if (s.s === code && s.st !== "deleted") add(s.la, s.lo, { radius: 6, color: "#5b21b6", weight: 2, fillColor: "#ede9fe", fillOpacity: 0.9 }, "<strong>Superfund:</strong> " + esc(s.n) + '<br><a href="' + esc(s.u) + '">EPA site profile</a>'); });
      r[2].sites.forEach(function (s) { if (s.s === code) add(s.la, s.lo, { radius: 8, color: "#854d0e", weight: 3, fillColor: "#fde047", fillOpacity: 0.95 }, "<strong>FUSRAP:</strong> " + esc(s.n) + '<br><a href="' + esc(s.u) + '">USACE site page</a>'); });
      r[3].installations.forEach(function (s) { if (s.s === code && s.la != null) add(s.la, s.lo, { radius: 6, color: "#0e7490", weight: 2, fillColor: "#cffafe", fillOpacity: 0.9 }, pfPopup(s, r[3].meta)); });
      r[5].lm.forEach(function (s) { if (s.s === code) add(s.la, s.lo, LM_STYLE, lmPopup(s)); });
      r[7].features.forEach(function (f) { L.geoJSON(f.geometry, { style: MRS_STYLE }).bindPopup(mrsPopup(f.properties)).addTo(map); });
      var fps = r[6].props.filter(function (x) { return x.la != null; });
      if (fps.length) { var fg = clusterGroup(); fps.forEach(function (x) { fg.addLayer(L.circleMarker([x.la, x.lo], x.k === "m" ? FUDS_STYLE : FUDSO_STYLE).bindPopup(fudsPopup(x))); if (x.k === "m") pts.push([x.la, x.lo]); }); map.addLayer(fg); }
      var aums = r[5].aum.filter(function (s) { return s.s === code; });
      if (aums.length) { var cg = clusterGroup(); aums.forEach(function (s) { cg.addLayer(L.circleMarker([s.la, s.lo], AUM_STYLE).bindPopup(aumPopup(s))); pts.push([s.la, s.lo]); }); map.addLayer(cg); }
      r[4].sites.forEach(function (s) { if (s.s === code && s.la != null) add(s.la, s.lo, { radius: 8, color: "#1e3a8a", weight: 3, fillColor: "#1d4ed8", fillOpacity: 0.85 }, seaPopup(s)); });
      (r[0].sites || []).forEach(function (s) { if (s.state === code) add(s.latitude, s.longitude, { radius: 8, color: "#1c1917", weight: 1, fillColor: "#166534", fillOpacity: 0.9 }, "<strong>Munitions:</strong> " + '<a href="' + base + "sites/" + encodeURIComponent(s.id) + '.html">' + esc(s.name) + "</a>"); });
      if (pts.length) map.fitBounds(pts, { padding: [24, 24], maxZoom: 9 }); else { map.setView([39.5, -98.35], 3); el.insertAdjacentHTML("afterend", '<p class="env-meta">No mapped sites in this state yet.</p>'); }
    });
  }
  function anzMode() {
    var base = script.getAttribute("data-base") || "";
    var el = document.getElementById("map");
    load(base + "data/anz.json").then(function (d) {
      var LAYERS = [
        { k: "sub", label: "UXO: substantial", col: "#b91c1c", fill: "#fecaca", on: true },
        { k: "sli", label: "UXO: slight", col: "#c2410c", fill: "#fed7aa", on: true },
        { k: "rem", label: "UXO: remote", col: "#a16207", fill: "#fef08a", on: true },
        { k: "oth", label: "Other / no UXO found", col: "#78716c", fill: "#f5f5f4", on: false },
        { k: "sea", label: "AU sea dumping", col: "#1d4ed8", fill: "#dbeafe", on: true },
        { k: "dc", label: "WWII depth charges", col: "#0f766e", fill: "#ccfbf1", on: true },
        { k: "au_pfas", label: "AU Defence PFAS (base location)", col: "#0e7490", fill: "#67e8f9", on: true },
        { k: "nz_pfas", label: "NZ PFAS (base location)", col: "#0e7490", fill: "#a5f3fc", on: true },
        { k: "nz_sea", label: "NZ ammunition dumping", col: "#1e3a8a", fill: "#93c5fd", on: true },
        { k: "nz_other", label: "NZ other munitions", col: "#7c2d12", fill: "#fdba74", on: true }
      ];
      var groups = {};
      var map = null;
      if (el && typeof L !== "undefined") {
        map = L.map(el, { scrollWheelZoom: false, preferCanvas: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18 }).addTo(map);
        map.fitBounds([[-44, 113], [-10, 179]]);
        LAYERS.forEach(function (l) { groups[l.k] = L.layerGroup(); if (l.on) groups[l.k].addTo(map); });
        d.sites.forEach(function (s) {
          if (s.la == null || s.lo == null) return;
          var key = s.L === "au_uxo" ? s.k : s.L, l = LAYERS.filter(function (x) { return x.k === key; })[0];
          if (!l) return;
          var note = s.base ? "<br><em>Base location, not the contamination location</em>" : "";
          L.circleMarker([s.la, s.lo], { radius: key === "oth" ? 4 : 6, color: l.col, weight: key === "oth" ? 1 : 2, fillColor: l.fill, fillOpacity: key === "oth" ? 0.5 : 0.9 })
            .bindPopup("<strong>" + esc(l.label) + ":</strong> " + esc(s.n) + note + (s.dd ? "<br>Data date: " + esc(s.dd) : "") + (s.u ? '<br><a href="' + esc(s.u) + '">Official source</a>' : ""))
            .addTo(groups[key]);
        });
      }
      var f = document.getElementById("anz-filters");
      if (f) {
        f.innerHTML = "<legend class=\"sr-only\">Map layers</legend>" + LAYERS.map(function (l) {
          return '<label class="env-check"><input type="checkbox" data-k="' + l.k + '"' + (l.on ? " checked" : "") + '> <i class="env-dot" style="border-color:' + l.col + ';background:' + l.fill + '" aria-hidden="true"></i> ' + esc(l.label) + "</label>";
        }).join("");
        Array.prototype.forEach.call(f.querySelectorAll("input"), function (cb) {
          cb.addEventListener("change", function () { if (!map) return; var g = groups[cb.getAttribute("data-k")]; if (cb.checked) g.addTo(map); else map.removeLayer(g); });
        });
      }
      var rows = d.sites.filter(function (s) { return s.L === "au_uxo"; });
      var sel = document.getElementById("uxo-state"), cat = document.getElementById("uxo-cat"), q = document.getElementById("uxo-q");
      var tb = document.querySelector("#uxo-table tbody"), cnt = document.getElementById("uxo-count");
      if (!tb) return;
      fillStates(sel, rows.map(function (r) { return r.st; }));
      Array.from(new Set(rows.map(function (r) { return r.cat; }))).sort().forEach(function (c) { var o = document.createElement("option"); o.value = c; o.textContent = c; cat.appendChild(o); });
      function draw() {
        var qq = (q.value || "").toLowerCase();
        var vis = rows.filter(function (r) { return (!sel.value || r.st === sel.value) && (!cat.value || r.cat === cat.value) && (!qq || (r.n + " " + r.d).toLowerCase().indexOf(qq) !== -1); });
        cnt.textContent = "Showing " + vis.length + " of " + rows.length + " areas. Source: Department of Defence UXO map, index last modified 2026-11-16.";
        tb.innerHTML = vis.map(function (r) { return "<tr><td>" + esc(r.n) + "</td><td>" + esc(r.st) + "</td><td>" + esc(r.cat) + (r.alerts ? "" : " <span class=\"env-meta\">(not used for alerts)</span>") + "</td><td>" + esc(r.d) + "</td></tr>"; }).join("");
      }
      [sel, cat].forEach(function (e) { e.addEventListener("change", draw); }); q.addEventListener("input", draw); draw();
    });
  }
  if (MODE === "anz") anzMode(); else if (MODE === "state") stateMode(); else if (MODE === "fusrap") fusMode(); else if (MODE === "pfas") pfasMode(); else if (MODE === "sea") seaMode(); else if (MODE === "nuclear") nuclearMode(); else if (MODE === "fuds") fudsMode(); else if (MODE === "superfund") sfMode(); else zipMode();
})();
