/* fl-factsheet.js — printable one-page fact sheet generated from any record: factsheet.html?k=<dataset>:<id> */
(function () {
  var F = window.FL, t = window.flT, esc = F.esc;
  var box = document.getElementById("fs");
  window.flApplyStatic();
  var key = new URLSearchParams(location.search).get("k") || "";
  if (!/^[a-z]+:[^\s]{1,200}$/i.test(key)) { box.innerHTML = '<p class="fl-error" role="alert">' + esc(t("sheet_notfound")) + "</p>"; return; }
  function longSec(id, title, text) {
    var long = String(text).length > 650;
    return '<section aria-labelledby="' + id + '"><h3 id="' + id + '">' + esc(title) + '</h3><p class="' + (long ? "fs-clamp" : "") + '">' + esc(text) + "</p>" +
      (long ? '<p class="print-only fs-more">' + esc(t("sheet_more_online")) + "</p>" : "") + "</section>";
  }
  function shortUrl(u) { u = String(u).replace(/^https?:\/\//, ""); return u.length > 70 ? u.slice(0, 67) + "…" : u; }
  function link(u, label) { u = F.safeUrl(u); return u ? '<a href="' + esc(u) + '">' + esc(label || u) + "</a>" : esc(label || ""); }
  Promise.all([F.manifest(), F.record(key)]).then(function (res) {
    var m = res[0], r = res[1];
    if (!r) { box.innerHTML = '<p class="fl-error" role="alert">' + esc(t("sheet_notfound")) + "</p>"; return; }
    var src = m.sources.filter(function (s) { return s.key === r.s; })[0] || { label: r.s, page: "" };
    var canonical = F.SITE + "factsheet.html?k=" + encodeURIComponent(key);
    var qrTarget = r.rec ? F.SITE + r.rec : canonical;
    document.title = t("sheet_title") + ": " + r.n + " | " + t("site_name");
    var loc = [r.loc, r.rg, r.c].filter(Boolean).join(", ");
    var coords = r.la != null && r.lo != null ? (+r.la).toFixed(4) + ", " + (+r.lo).toFixed(4) : (r.area ? t("area_outline_note") : t("sheet_coords_none"));
    var figs = (r.fig || []).filter(function (f) { return f && f[1] !== "" && f[1] != null && !(r.st && /^status/i.test(f[0]) && String(f[1]) === String(r.st)); });
    var sources = (r.src || []).filter(function (s) { return s.u || s.t; });
    var vt = F.vText(r.v, r.reg);
    var html =
      '<header class="fs-head"><div class="fs-head-main"><p class="fs-kicker">' + esc(t("sheet_title")) + " · " + esc(t("site_name")) + " · " + esc(t("byline")) + "</p>" +
      "<h2 id=\"fs-title\" class=\"fs-title\">" + esc(r.n) + "</h2>" +
      (loc ? '<p class="fs-loc"><span class="fs-label">' + esc(t("sheet_location")) + ":</span> " + esc(loc) + "</p>" : "") + "</div>" +
      '<div class="fs-qr-wrap"><div id="fs-qr" class="fs-qr" role="img" aria-label="' + esc(t("sheet_qr") + ": " + qrTarget) + '"></div><p class="fs-qr-cap">' + esc(t("sheet_qr")) + '<br><span class="fs-url">' + esc(qrTarget) + "</span></p></div></header>" +
      '<section class="fs-risk" aria-labelledby="fs-risk-h"><h3 id="fs-risk-h">' + esc(t("sheet_risk")) + "</h3><p>" + esc(t("risk_" + r.cat)) + "</p></section>" +
      '<div class="fs-grid">' +
      longSec("fs-what-h", t("sheet_what"), r.what || t("sheet_what_none")) +
      (r.st ? longSec("fs-st-h", t("sheet_status"), r.st) : "") + "</div>" +
      '<section aria-labelledby="fs-facts-h" class="fs-facts"><h3 id="fs-facts-h" class="sr-only">' + esc(t("sheet_figures")) + '</h3><dl class="fs-dl">' +
        "<div><dt>" + esc(t("sheet_hazard")) + "</dt><dd>" + esc(t("cat_" + r.cat)) + " · " + esc(r.L) + (r.ty ? " (" + esc(r.ty) + ")" : "") + "</dd></div>" +
        "<div><dt>" + esc(t("source_layer")) + "</dt><dd>" + esc(src.label) + "</dd></div>" +
        "<div><dt>" + esc(t("sheet_verification")) + '</dt><dd><span class="fs-badge fs-badge--' + esc(r.v ? r.v.replace(/\s+/g, "-") : (r.reg ? "register" : "none")) + '">' + esc(vt) + "</span></dd></div>" +
        "<div><dt>" + esc(t("sheet_coords")) + "</dt><dd>" + esc(coords) + "</dd></div>" +
        (r.cp ? "<div><dt>" + esc(t("sheet_coord_note")) + "</dt><dd>" + esc(r.cp) + "</dd></div>" : "") +
        (r.dt ? "<div><dt>" + esc(t("sheet_date")) + "</dt><dd>" + esc(r.dt) + "</dd></div>" : "") +
        "<div><dt>" + esc(t("sheet_checked")) + "</dt><dd>" + esc(r.chk || "—") + "</dd></div>" +
      "</dl></section>" +
      (figs.length ? '<section aria-labelledby="fs-fig-h"><h3 id="fs-fig-h">' + esc(t("sheet_figures")) + '</h3><table class="fs-table"><tbody>' +
        figs.map(function (f) { return '<tr><th scope="row">' + esc(f[0]) + '</th><td><span class="fs-clamp3">' + esc(f[1]) + "</span></td></tr>"; }).join("") + "</tbody></table>" +
        (figs.some(function (f) { return String(f[1]).length > 220; }) ? '<p class="print-only fs-more">' + esc(t("sheet_more_online")) + "</p>" : "") + "</section>" : "") +
      '<section aria-labelledby="fs-src-h"><h3 id="fs-src-h">' + esc(t("sheet_sources")) + "</h3>" +
        (sources.length ? '<ol class="fs-sources">' + sources.map(function (s) { return "<li>" + link(s.u, s.t || s.u) + (s.u ? ' <span class="fs-url">' + esc(shortUrl(s.u)) + "</span>" : "") + "</li>"; }).join("") + "</ol>" +
          (sources.length > 4 ? '<p class="print-only fs-more">' + esc(t("sheet_sources_more", { n: sources.length - 4 })) + "</p>" : "") : "<p>" + esc(t("sheet_sources_none")) + "</p>") +
      "</section>" +
      '<div class="fs-foot" role="contentinfo">' +
        '<div class="fs-by"><p><strong>' + esc(t("byline")) + "</strong> · " + link(F.SITE, t("site_url")) + "</p><p>" + esc(t("sheet_record_id")) + ": " + esc(key) + "</p><p>" + esc(t("sheet_disclaimer")) + "</p></div></div>" +
      '<p class="fs-actions no-print"><button type="button" class="fl-btn" id="fs-print">' + esc(t("sheet_print")) + "</button> " +
        (r.rec ? link(r.rec, t("open_record")) + " · " : "") + (src.page ? link(src.page, t("open_layer")) + " · " : "") + link("lookup.html", t("sheet_back")) + "</p>";
    box.innerHTML = html;
    try {
      var qr = qrcode(0, "M"); qr.addData(qrTarget); qr.make();
      document.getElementById("fs-qr").innerHTML = qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true });
      var svg = document.querySelector("#fs-qr svg"); if (svg) { svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false"); }
    } catch (e) { /* QR is optional; URL text is printed beside it */ }
    document.getElementById("fs-print").addEventListener("click", function () { window.print(); });
    var c = document.querySelector('link[rel="canonical"]'); if (c) c.href = canonical;
    document.getElementById("fs-title").setAttribute("tabindex", "-1");
  }).catch(function () { box.innerHTML = '<p class="fl-error" role="alert">' + esc(t("err_data")) + "</p>"; });
})();
