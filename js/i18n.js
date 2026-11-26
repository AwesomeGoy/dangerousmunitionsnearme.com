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
