/* Dangerous Munitions Near Me — interface language runtime (draft).
 * Loads ONLY the chosen language file from /i18n/<lang>.json.
 * Does not translate record names, source titles or quotations.
 * Public API for other drafts (PWA, lookup, alerts/tips):
 *   window.DMNM_I18N.t(key, vars)
 *   window.DMNM_I18N.ready(callback)
 *   window.DMNM_I18N.lang / .locale / .dir
 */
(function () {
  "use strict";

  var VERSION = "1";
  var STORAGE_KEY = "dmnm-lang";
  var CACHE_PREFIX = "dmnm-i18n-v" + VERSION + "-";
  var DEFAULT_LANG = "en";
  var SUPPORTED = {
    en: { locale: "en", dir: "ltr", name: "English" },
    es: { locale: "es", dir: "ltr", name: "Español" },
    fr: { locale: "fr", dir: "ltr", name: "Français" },
    pt: { locale: "pt", dir: "ltr", name: "Português" },
    ar: { locale: "ar", dir: "rtl", name: "العربية" },
    ru: { locale: "ru", dir: "ltr", name: "Русский" },
    uk: { locale: "uk", dir: "ltr", name: "Українська" },
    zh: { locale: "zh-Hans", dir: "ltr", name: "中文（简体）" },
    hi: { locale: "hi", dir: "ltr", name: "हिन्दी" },
    ja: { locale: "ja", dir: "ltr", name: "日本語" },
    de: { locale: "de", dir: "ltr", name: "Deutsch" },
    ko: { locale: "ko", dir: "ltr", name: "한국어" },
    vi: { locale: "vi", dir: "ltr", name: "Tiếng Việt" },
    id: { locale: "id", dir: "ltr", name: "Bahasa Indonesia" },
    tr: { locale: "tr", dir: "ltr", name: "Türkçe" }
  };

  var strings = {};
  var readyCallbacks = [];
  var isReady = false;
  var loadFailed = false;

  function basePath() {
    if (window.DMNM_I18N_BASE) return window.DMNM_I18N_BASE;
    var script = document.currentScript || document.querySelector('script[src*="i18n.js"]');
    if (script && script.src) {
      return script.src.replace(/\/js\/i18n\.js(?:\?.*)?$/, "/i18n/");
    }
    return "/i18n/";
  }

  function normalize(code) {
    if (!code) return null;
    var raw = String(code).replace(/_/g, "-").trim();
    var lower = raw.toLowerCase();
    if (SUPPORTED[lower]) return lower;
    if (lower === "zh-cn" || lower === "zh-sg" || lower.indexOf("zh-hans") === 0) return "zh";
    if (lower.indexOf("zh-hant") === 0 || lower === "zh-tw" || lower === "zh-hk") return "zh";
    if (lower.indexOf("pt") === 0) return "pt";
    var pre = lower.split("-")[0];
    if (SUPPORTED[pre]) return pre;
    return null;
  }

  function persist(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function storedLang() {
    try { return normalize(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
  }

  function detect() {
    try {
      var params = new URLSearchParams(window.location.search);
      var fromQuery = normalize(params.get("lang"));
      if (fromQuery) {
        persist(fromQuery);
        return fromQuery;
      }
    } catch (e) {}
    var saved = storedLang();
    if (saved) return saved;
    var list = [];
    try {
      if (navigator.languages && navigator.languages.length) list = list.concat(navigator.languages);
    } catch (e) {}
    if (navigator.language) list.push(navigator.language);
    if (navigator.userLanguage) list.push(navigator.userLanguage);
    for (var i = 0; i < list.length; i++) {
      var n = normalize(list[i]);
      if (n) return n;
    }
    return DEFAULT_LANG;
  }

  function applyRoot(lang) {
    var meta = SUPPORTED[lang] || SUPPORTED[DEFAULT_LANG];
    var el = document.documentElement;
    el.lang = meta.locale;
    el.setAttribute("lang", meta.locale);
    el.setAttribute("dir", meta.dir);
    el.classList.toggle("is-rtl", meta.dir === "rtl");
    if (lang !== "en") el.classList.add("i18n-pending");
    else el.classList.remove("i18n-pending");
  }

  var lang = detect();
  applyRoot(lang);

  function interpolate(s, vars) {
    if (!vars) return s;
    return String(s).replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, k) {
      return vars[k] != null ? String(vars[k]) : "{" + k + "}";
    });
  }

  function t(key, vars) {
    var s = Object.prototype.hasOwnProperty.call(strings, key) ? strings[key] : null;
    if (s == null) return interpolate(key, vars);
    return interpolate(s, vars);
  }

  /* Trusted interface strings only — never pass unsanitized user input. */
  function tHTML(key, vars) {
    return t(key, vars);
  }

  function cacheGet(code) {
    try {
      var raw = sessionStorage.getItem(CACHE_PREFIX + code);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function cacheSet(code, data) {
    try { sessionStorage.setItem(CACHE_PREFIX + code, JSON.stringify(data)); } catch (e) {}
  }

  function setTextPreserveChildren(el, text) {
    var i, node, replaced = false;
    for (i = 0; i < el.childNodes.length; i++) {
      node = el.childNodes[i];
      if (node.nodeType === 3 && node.textContent.trim()) {
        var lead = node.textContent.match(/^\s*/)[0];
        var tail = node.textContent.match(/\s*$/)[0] || (el.children.length ? " " : "");
        node.textContent = lead + text + tail;
        replaced = true;
        break;
      }
    }
    if (!replaced) {
      if (el.children.length) {
        el.insertBefore(document.createTextNode(text + " "), el.firstChild);
      } else {
        el.textContent = text;
      }
    }
  }

  function applyToElement(el) {
    var key, val;
    key = el.getAttribute("data-i18n");
    if (key) setTextPreserveChildren(el, t(key));
    key = el.getAttribute("data-i18n-html");
    if (key) el.innerHTML = tHTML(key);
    key = el.getAttribute("data-i18n-placeholder");
    if (key) el.setAttribute("placeholder", t(key));
    key = el.getAttribute("data-i18n-aria");
    if (key) el.setAttribute("aria-label", t(key));
    key = el.getAttribute("data-i18n-alt");
    if (key) el.setAttribute("alt", t(key));
    key = el.getAttribute("data-i18n-title");
    if (key) el.setAttribute("title", t(key));
    key = el.getAttribute("data-i18n-value");
    if (key) el.setAttribute("value", t(key));
  }

  function pageTitleKey() {
    var marked = document.body && document.body.getAttribute("data-i18n-page");
    if (marked) return "title." + marked;
    var path = (window.location.pathname || "/").replace(/\/index\.html$/, "/");
    if (path === "/index.html" || path === "" || path === "/") return "title.home";
    var map = {
      "/about.html": "title.about",
      "/privacy.html": "title.privacy",
      "/offline.html": "title.offline",
      "/confirmed.html": "title.confirmed",
      "/comments.html": "title.comments",
      "/timeline.html": "title.timeline",
      "/records.html": "title.records",
      "/stories.html": "title.stories",
      "/more-maps.html": "title.more_maps",
      "/nearby.html": "title.nearby",
      "/pfas.html": "title.pfas",
      "/superfund.html": "title.superfund",
      "/fusrap.html": "title.fusrap",
      "/fuds.html": "title.fuds",
      "/sea-dumps.html": "title.sea_dumps",
      "/nuclear-legacy.html": "title.nuclear_legacy",
      "/moderation.html": "title.moderation",
      "/states/": "title.by_state",
      "/topics/": "title.topics",
      "/canada/": "title.canada",
      "/europe/": "title.europe",
      "/anz/": "title.anz",
      "/africa/": "title.africa",
      "/africa/south-africa/": "title.south_africa",
      "/south-america/": "title.south_america",
      "/antarctica/": "title.antarctica",
      "/arctic/": "title.arctic",
      "/middle-east/": "title.middle_east",
      "/asia/": "title.asia",
      "/petroleum/": "title.petroleum",
      "/nuclear-tests/": "title.nuclear_tests",
      "/chemical-weapons/": "title.chemical_weapons",
      "/chemical-plants/": "title.chemical_plants",
      "/nuclear-accidents/": "title.nuclear_accidents",
      "/ranges/": "title.ranges",
      "/uxo/": "title.uxo",
      "/tailings/": "title.tailings"
    };
    if (map[path]) return map[path];
    for (var p in map) {
      if (p !== "/" && path.indexOf(p) === 0) return map[p];
    }
    return null;
  }

  function applyTitles() {
    var key = pageTitleKey();
    if (key && strings[key]) document.title = t(key);
    var metaKey = key && key.replace(/^title\./, "meta.");
    if (metaKey && strings[metaKey]) {
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", t(metaKey));
      var og = document.querySelector('meta[property="og:description"]');
      if (og) og.setAttribute("content", t(metaKey));
      var tw = document.querySelector('meta[name="twitter:description"]');
      if (tw) tw.setAttribute("content", t(metaKey));
      var ogt = document.querySelector('meta[property="og:title"]');
      if (ogt && strings[key]) ogt.setAttribute("content", t(key));
    }
  }

  function originSite() {
    return "https://dangerousmunitionsnearme.com";
  }

  function pagePath() {
    var path = window.location.pathname || "/";
    if (!path.endsWith("/") && !/\.[a-z0-9]+$/i.test(path)) path += "/";
    return path;
  }

  function ensureHreflang() {
    var head = document.head;
    if (!head) return;
    head.querySelectorAll('link[data-i18n-hreflang]').forEach(function (n) { n.remove(); });
    var path = pagePath();
    var codes = Object.keys(SUPPORTED);
    codes.push("x-default");
    codes.forEach(function (code) {
      var link = document.createElement("link");
      link.rel = "alternate";
      link.setAttribute("data-i18n-hreflang", "true");
      if (code === "x-default") {
        link.hreflang = "x-default";
        link.href = originSite() + path;
      } else {
        link.hreflang = SUPPORTED[code].locale;
        link.href = originSite() + path + "?lang=" + code;
      }
      head.appendChild(link);
    });
  }

  function markRecordLanguage() {
    /* Record data stays in its original language (English in this inventory). */
    var nodes = document.querySelectorAll(
      "[data-record], #sites-table tbody, .comment-item a, .comment-item h3, .comment-item .summary, .comment-item .types, table.records td, .sources-inline"
    );
    nodes.forEach(function (n) {
      if (!n.getAttribute("lang")) n.setAttribute("lang", "en");
    });
  }

  function applyAll() {
    document.querySelectorAll(
      "[data-i18n], [data-i18n-html], [data-i18n-placeholder], [data-i18n-aria], [data-i18n-alt], [data-i18n-title], [data-i18n-value]"
    ).forEach(applyToElement);
    applyTitles();
    ensureHreflang();
    markRecordLanguage();
    syncPicker();
    announce();
  }

  function announce() {
    var live = document.getElementById("dmnm-lang-status");
    if (!live) return;
    var name = (SUPPORTED[lang] && SUPPORTED[lang].name) || lang;
    live.textContent = t("lang.changed", { name: name });
  }

  function syncPicker() {
    var sel = document.getElementById("dmnm-lang-select");
    if (!sel) return;
    if (sel.value !== lang) sel.value = lang;
    sel.setAttribute("aria-activedescendant", "");
    var opt = sel.options[sel.selectedIndex];
    if (opt) sel.setAttribute("aria-describedby", "dmnm-lang-help");
  }

  function buildPickerOptions(sel) {
    if (!sel || sel.getAttribute("data-i18n-built") === "true") {
      if (sel) sel.value = lang;
      return;
    }
    sel.innerHTML = "";
    Object.keys(SUPPORTED).forEach(function (code) {
      var o = document.createElement("option");
      o.value = code;
      o.lang = SUPPORTED[code].locale;
      o.dir = SUPPORTED[code].dir;
      o.textContent = SUPPORTED[code].name;
      if (code === lang) o.selected = true;
      sel.appendChild(o);
    });
    sel.setAttribute("data-i18n-built", "true");
    sel.value = lang;
  }

  function onPickerChange(ev) {
    var next = normalize(ev.target.value);
    if (!next || next === lang) return;
    persist(next);
    var url = new URL(window.location.href);
    url.searchParams.set("lang", next);
    window.location.assign(url.toString());
  }

  function enhancePicker() {
    var sel = document.getElementById("dmnm-lang-select");
    if (!sel) return;
    buildPickerOptions(sel);
    sel.removeEventListener("change", onPickerChange);
    sel.addEventListener("change", onPickerChange);
  }

  function reveal(failed) {
    var el = document.documentElement;
    el.classList.remove("i18n-pending");
    el.classList.toggle("i18n-ready", !failed);
    el.classList.toggle("i18n-failed", !!failed);
  }

  function finish(ok, skipApply) {
    if (ok && !skipApply) applyAll();
    enhancePicker();
    reveal(!ok);
    isReady = true;
    loadFailed = !ok;
    var cbs = readyCallbacks.splice(0);
    cbs.forEach(function (fn) {
      try { fn(api); } catch (e) {}
    });
    try {
      document.dispatchEvent(new CustomEvent("dmnm-i18n-ready", { detail: { lang: lang, ok: ok } }));
    } catch (e) {}
  }

  function useBundle(data) {
    if (!data || typeof data !== "object") return false;
    strings = data.strings && typeof data.strings === "object" ? data.strings : data;
    return true;
  }

  function fetchLang(code) {
    var url = basePath() + encodeURIComponent(code) + ".json";
    return fetch(url, { credentials: "same-origin", cache: "force-cache" }).then(function (r) {
      if (!r.ok) throw new Error("Could not load " + url);
      return r.json();
    }).then(function (data) {
      cacheSet(code, data);
      return data;
    });
  }

  var cached = lang === "en" ? null : cacheGet(lang);
  if (lang === "en") {
    /* The page is already in English: no language file to fetch and nothing to swap. */
    var goEn = function () { finish(true, true); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", goEn, { once: true });
    else goEn();
  } else if (cached && useBundle(cached)) {
    /* Apply as soon as the DOM is ready; already sync-capable for t(). */
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { finish(true); }, { once: true });
    } else {
      finish(true);
    }
    /* Refresh cache in the background. */
    fetchLang(lang).then(function (data) {
      if (useBundle(data) && isReady) applyAll();
    }).catch(function () {});
  } else {
    fetchLang(lang).then(function (data) {
      if (!useBundle(data) && lang !== DEFAULT_LANG) {
        return fetchLang(DEFAULT_LANG).then(function (en) { useBundle(en); });
      }
    }).then(function () {
      var go = function () { finish(!!Object.keys(strings).length); };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", go, { once: true });
      } else {
        go();
      }
    }).catch(function () {
      var go = function () { finish(false); };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", go, { once: true });
      } else {
        go();
      }
    });
  }

  setTimeout(function () {
    if (!isReady && lang !== "en") finish(Object.keys(strings).length > 0);
  }, 1500);

  var api = {
    version: 1,
    format: "flat keys in strings, {name} interpolation",
    storageKey: STORAGE_KEY,
    get lang() { return lang; },
    get locale() { return (SUPPORTED[lang] || SUPPORTED.en).locale; },
    get dir() { return (SUPPORTED[lang] || SUPPORTED.en).dir; },
    supported: Object.keys(SUPPORTED),
    supportedMeta: SUPPORTED,
    t: function (key, vars) {
      /* Allow t(key, fallback, vars) for patched scripts, or t(key, vars). */
      if (vars != null && typeof vars !== "object") {
        /* t(key, fallbackString) */
        var fallback = vars;
        var more = arguments[2];
        var got = Object.prototype.hasOwnProperty.call(strings, key) ? interpolate(strings[key], more) : interpolate(fallback, more);
        return got;
      }
      if (Object.prototype.hasOwnProperty.call(strings, key)) return interpolate(strings[key], vars);
      if (typeof vars === "object" && vars && vars._fallback) return interpolate(vars._fallback, vars);
      return interpolate(key, vars);
    },
    tHTML: tHTML,
    ready: function (cb) {
      if (typeof cb !== "function") return;
      if (isReady) cb(api);
      else readyCallbacks.push(cb);
    },
    apply: applyAll,
    detect: detect,
    normalize: normalize
  };

  window.DMNM_I18N = api;
})();
/* dmnm-i18n2 */
  /* Phrase layer: translates remaining interface text by exact match on its English HTML.
   * Loads i18n/phrases/<lang>.json only when the language is not English. Record areas, source lists
   * and the email-alerts form are skipped, so record names, agency names and source titles stay as published. */
  (function () {
    var api = window.DMNM_I18N; if (!api) return;
    var lang = api.lang;
    var COLLECT = window.DMNM_I18N2_COLLECT || null;  // QA/extraction hook: records English keys that have no translation
    if (lang === "en" && !COLLECT) return;
    var sc = document.currentScript || document.querySelector('script[src*="i18n.js"]');
    var base = window.DMNM_I18N_BASE || (sc && sc.src ? sc.src.replace(/\/js\/i18n\.js(?:\?.*)?$/, "/i18n/") : "/i18n/");
    var INLINE = { A: 1, STRONG: 1, EM: 1, B: 1, I: 1, SMALL: 1, SPAN: 1, BR: 1, ABBR: 1, SUB: 1, SUP: 1, TIME: 1, MARK: 1, Q: 1, CITE: 1, CODE: 1, U: 1 };
    var SKIP = "script,style,noscript,template,svg,textarea,pre,.alerts-box,.env-sources,.lang-picker,[data-record],#sites-table tbody," +
      ".leaflet-tile-pane,.leaflet-control-attribution,.marker-cluster,[data-i18n-skip],[translate=no]";
    var SOFT = "[data-i18n],[data-i18n-html],[data-t]";  // already tagged: never replaced whole, but text that scripts put there later is still checked
    var cur = null, dict = null, res = [], seen = typeof WeakSet === "function" ? new WeakSet() : null;
    var LETTER = /[A-Za-z]{2}/;
    function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\u00a0/g, "&nbsp;"); }
    function has(k) { return !!dict && Object.prototype.hasOwnProperty.call(dict, k); }
    function find(key) {
      if (!key || !LETTER.test(key)) return null;
      if (has(key)) return dict[key];
      var c = key.match(/^(.+?) \(([\d.,]+)\)$/);  // "Label (21)": translate the label, keep the count
      if (c && has(c[1])) return dict[c[1]] + " (" + c[2] + ")";
      for (var i = 0; i < res.length; i++) { var m = key.match(res[i][0]); if (m) return res[i][1].replace(/\$(\d)/g, function (_, d) { return m[+d] || ""; }); }
      return null;
    }
    function look(key) {
      var out = find(key);
      if (out == null && COLLECT && key && LETTER.test(key)) COLLECT(key, cur);
      return out;
    }
    function inlineOnly(el) {
      var all = el.getElementsByTagName("*");
      for (var i = 0; i < all.length; i++) if (!INLINE[all[i].tagName]) return false;
      return true;
    }
    function setHTML(el, html) { if (html.indexOf("<") === -1 && html.indexOf("&") === -1) el.textContent = html; else el.innerHTML = html; }
    function textNode(n) {
      cur = n.parentNode; var raw = n.nodeValue; if (!LETTER.test(raw)) return;
      var key = esc(norm(raw)), out = look(key);
      if (out == null && key.indexOf(" · ") !== -1) {  // "label · label · value" runs: translate each known piece
        var parts = key.split(" · "), hit = false;
        parts = parts.map(function (p) { var v = find(norm(p)); if (v != null) { hit = true; return v; } return p; });
        if (hit) out = parts.join(" · ");
      }
      if (out == null) return;
      var lead = raw.match(/^\s*/)[0], tail = raw.match(/\s*$/)[0];
      if (out.indexOf("<") === -1) { var tmp = document.createElement("span"); tmp.innerHTML = out; n.nodeValue = lead + tmp.textContent + tail; }
      else { var span = document.createElement("span"); span.innerHTML = lead + out + tail; while (span.firstChild) n.parentNode.insertBefore(span.firstChild, n); n.parentNode.removeChild(n); }
    }
    function attrs(el) {
      ["placeholder", "aria-label", "title", "alt"].forEach(function (a) {
        var v = el.getAttribute(a); if (!v) return;
        var out = look(esc(norm(v))); if (out != null) { var tmp = document.createElement("span"); tmp.innerHTML = out; el.setAttribute(a, tmp.textContent); }
      });
    }
    function walk(el) {
      if (el.nodeType !== 1 || (el.matches && el.matches(SKIP))) return;
      cur = el; attrs(el);
      if (!(el.matches && el.matches(SOFT)) && (el.tagName === "OPTION" || inlineOnly(el))) {
        var key = norm(el.innerHTML);
        if (LETTER.test(el.textContent)) { var out = look(key); if (out != null) { setHTML(el, out); return; } }
      }
      var kids = Array.prototype.slice.call(el.childNodes);
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].nodeType === 3) textNode(kids[i]); else if (kids[i].nodeType === 1) walk(kids[i]);
      }
    }
    function titleAndMeta() {
      var t = look(esc(norm(document.title))); if (t != null) { var tmp = document.createElement("span"); tmp.innerHTML = t; document.title = tmp.textContent; }
      var d = document.querySelector('meta[name="description"]');
      if (d) { var o = look(esc(norm(d.getAttribute("content") || ""))); if (o != null) { var tmp2 = document.createElement("span"); tmp2.innerHTML = o; d.setAttribute("content", tmp2.textContent); } }
    }
    var busy = false, queue = [], obs = null;
    function run(nodes) {
      busy = true;
      try { nodes.forEach(function (n) { if (n.nodeType === 3) { if (n.parentNode && !(n.parentNode.closest && n.parentNode.closest(SKIP))) textNode(n); } else if (n.nodeType === 1 && document.contains(n) && !(n.closest && n.closest(SKIP))) walk(n); }); }
      finally { if (obs) obs.takeRecords(); busy = false; }  // drop the records our own edits made
    }
    function start() {
      titleAndMeta(); run([document.body]);
      if (typeof MutationObserver !== "function") return;
      var timer = null;
      obs = new MutationObserver(function (muts) {
        if (busy) return;
        muts.forEach(function (m) {
          if (m.type === "characterData") queue.push(m.target);
          else for (var i = 0; i < m.addedNodes.length; i++) queue.push(m.addedNodes[i]);
        });
        if (!timer) timer = setTimeout(function () { timer = null; var q = queue.splice(0); run(q); }, 0);
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }
    var loaded = lang === "en" ? Promise.resolve({ phrases: {}, patterns: [] }) :
      fetch(base + "phrases/" + encodeURIComponent(lang) + ".json", { credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error("phrases"); return r.json(); });
    loaded.then(function (d) {
      dict = d.phrases || {};
      res = (d.patterns || []).map(function (p) { return [new RegExp("^" + p[0] + "$"), p[1]]; });
      api.ready(function () { if (document.body) start(); else document.addEventListener("DOMContentLoaded", start, { once: true }); });
    }).catch(function () {});
  })();
/* /dmnm-i18n2 */
/* dmnm-gloss */
(function () {
  /* Plain-language explanations for short labels (OB/OD, demil, FUDS, NPDES, ...): dropdown labels, table-cell tooltips,
     and the "What these labels mean" glossary. Strings come from i18n/gloss/<lang>.json (English included). */
  if (window.DMNM_GLOSS) return;
  window.DMNM_GLOSS = true;
  var api = window.DMNM_I18N || {};
  var lang = api.lang || document.documentElement.getAttribute("lang") || "en";
  var me = document.currentScript;
  var base = me && me.src ? me.src.replace(/js\/i18n\.js(?:\?.*)?$/, "") : "";
  var G = null;
  function term(id) { return G && G.terms[id]; }
  function name(id) { var t = term(id); return t ? (t.name || t.abbr) : ""; }
  function optText(id) { var t = term(id); return t ? name(id) + " (" + t.short + ")" : ""; }
  function tip(id) { var t = term(id); return t ? name(id) + " (" + t.short + "): " + t.def : ""; }
  function selects() {
    [["f-type", "type"], ["f-verification", "verification"], ["f-depth", "depth"]].forEach(function (p) {
      var sel = document.getElementById(p[0]); if (!sel) return;
      var map = G.maps[p[1]];
      Array.prototype.forEach.call(sel.options, function (o) {
        var id = map[o.value]; if (!id || o.getAttribute("data-gloss") === lang) return;
        o.setAttribute("data-i18n-skip", ""); o.setAttribute("data-gloss", lang);
        o.textContent = optText(id); o.title = term(id).def;
      });
    });
  }
  function cells() {
    var tb = document.querySelector("#sites-table tbody"); if (!tb) return;
    Array.prototype.forEach.call(tb.querySelectorAll("td.types:not([data-gloss])"), function (td) {
      var parts = td.textContent.split(/,\s*/).filter(Boolean);
      td.textContent = "";
      parts.forEach(function (v, i) {
        if (i) td.appendChild(document.createTextNode(", "));
        var id = G.maps.type[v];
        if (!id) { td.appendChild(document.createTextNode(v)); return; }
        var a = document.createElement("abbr"); a.title = tip(id); a.textContent = v; td.appendChild(a);
      });
      td.setAttribute("data-gloss", "");
    });
    Array.prototype.forEach.call(tb.querySelectorAll("span.badge:not([data-gloss])"), function (b) {
      var v = b.textContent.trim(), id = G.maps.verification[v] || G.maps.depth[v];
      if (id) b.title = tip(id);
      b.setAttribute("data-gloss", "");
    });
  }
  var TERMS_RE = null;
  function labels() {
    /* Tooltips on filter labels, legends and result headings that use an acronym (attribute only; text is untouched). */
    if (!TERMS_RE) {
      var keys = Object.keys(G.terms).filter(function (k) { return /^[A-Z]/.test(G.terms[k].abbr); })
        .sort(function (a, b) { return G.terms[b].abbr.length - G.terms[a].abbr.length; });
      TERMS_RE = keys.map(function (k) { return [k, new RegExp("(^|[^A-Za-z])" + G.terms[k].abbr.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&") + "(?![A-Za-z])")]; });
    }
    var q = "#lv-filters label, #lv-water legend, #lv-water label, .lv-states legend, .env-legend > span, .env-results strong, .filters label";
    Array.prototype.forEach.call(document.querySelectorAll(q), function (el) {
      if (el.getAttribute("data-gloss") === lang || el.querySelector("select")) return;
      var txt = el.textContent, hit = null;
      for (var i = 0; i < TERMS_RE.length && !hit; i++) if (TERMS_RE[i][1].test(txt)) hit = TERMS_RE[i][0];
      if (hit) { el.title = tip(hit); el.setAttribute("data-gloss", lang); }
    });
  }
  function glossBox() {
    Array.prototype.forEach.call(document.querySelectorAll("details.dmnm-gloss"), function (box) {
      if (box.getAttribute("data-gloss") === lang) return;
      var s = box.querySelector("summary"); if (s) s.textContent = G.ui.summary;
      var p = box.querySelector(".gl-intro"); if (p) p.textContent = G.ui.intro;
      Array.prototype.forEach.call(box.querySelectorAll("[data-g]"), function (el) {
        var id = el.getAttribute("data-g"), t = term(id); if (!t) return;
        if (el.tagName === "DT") { var n = el.querySelector(".gl-short"); if (n) n.textContent = t.short; var nm = el.querySelector(".gl-name"); if (nm) nm.textContent = name(id); var ab = el.querySelector("abbr"); if (ab) ab.title = t.short; }
        else { var d = el.querySelector(".gl-def"); if (d) d.textContent = t.def; }
      });
      Array.prototype.forEach.call(box.querySelectorAll(".gl-srclabel"), function (el) { el.textContent = G.ui.source + ":"; });
      Array.prototype.forEach.call(box.querySelectorAll(".gl-sitelabel"), function (el) { el.textContent = "(" + G.ui.site_label + ")"; });
      box.setAttribute("data-gloss", lang);
    });
  }
  var busy = false;
  function run() {
    if (!G || busy) return; busy = true;
    try { selects(); cells(); labels(); if (lang !== "en") glossBox(); } finally { busy = false; }
  }
  function start() {
    run();
    var mo = new MutationObserver(function () { run(); mo.takeRecords(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  var ready = function (fn) { if (document.body) fn(); else document.addEventListener("DOMContentLoaded", fn, { once: true }); };
  if (!window.fetch) return;
  fetch(base + "i18n/gloss/" + (/^[a-z]{2}$/.test(lang) ? lang : "en") + ".json").then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; })
    .then(function (d) {
      if (!d && lang !== "en") return fetch(base + "i18n/gloss/en.json").then(function (r) { return r.ok ? r.json() : null; });
      return d;
    })
    .then(function (d) { if (d) { G = d; ready(start); } });
})();
/* /dmnm-gloss */
