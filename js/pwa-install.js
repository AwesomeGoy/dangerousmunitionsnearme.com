/* Dangerous Munitions Near Me: small, dismissible "Install app" button.
 * - Chrome/Edge/Android: uses the browser's own beforeinstallprompt event.
 * - iPhone/iPad Safari: shows a one-line "Share > Add to Home Screen" hint.
 * Hidden when already installed. "Not now" is remembered on this device only
 * (localStorage, 30 days). Nothing is sent anywhere; no tracking.
 */
(function () {
  "use strict";
  var KEY = "dmnm-install-dismissed";
  var DAYS = 30;
  var deferred = null;
  var bar = null;

  function standalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      window.navigator.standalone === true;
  }
  function dismissedRecently() {
    try {
      var t = parseInt(localStorage.getItem(KEY) || "0", 10);
      return t && (Date.now() - t) < DAYS * 864e5;
    } catch (e) { return false; }
  }
  function remember() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
  }
  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }
  function style() {
    if (document.getElementById("pwa-install-style")) return;
    var s = document.createElement("style");
    s.id = "pwa-install-style";
    s.textContent =
      ".pwa-install{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:2000;max-width:min(92vw,360px);" +
      "display:flex;align-items:center;gap:8px;padding:8px 8px 8px 12px;background:#fffdf8;color:#1c1917;" +
      "border:1px solid #c2410c;border-radius:10px;box-shadow:0 4px 14px rgba(28,25,23,.18);" +
      "font:15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}" +
      ".pwa-install p{margin:0;flex:1}" +
      ".pwa-install .pwa-go{background:#9a3412;color:#fff;border:0;border-radius:8px;min-height:44px;padding:8px 14px;font:inherit;font-weight:600;cursor:pointer}" +
      ".pwa-install .pwa-x{background:transparent;border:0;color:#57534e;font:inherit;font-size:22px;line-height:1;min-width:44px;min-height:44px;padding:0;cursor:pointer}" +
      ".pwa-install button:focus-visible{outline:3px solid #1c1917;outline-offset:2px}" +
      "@media print{.pwa-install{display:none}}";
    document.head.appendChild(s);
  }
  function hide() {
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
  }
  function closeBtn() {
    var x = document.createElement("button");
    x.type = "button";
    x.className = "pwa-x";
    x.setAttribute("aria-label", "Dismiss install suggestion");
    x.title = "Not now";
    x.textContent = "\u00d7";
    x.addEventListener("click", function () { remember(); hide(); });
    return x;
  }
  function show(kind) {
    if (bar || standalone() || dismissedRecently()) return;
    style();
    bar = document.createElement("div");
    bar.className = "pwa-install";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Install this site as an app");
    bar.addEventListener("keydown", function (e) { if (e.key === "Escape") { remember(); hide(); } });
    if (kind === "prompt") {
      var go = document.createElement("button");
      go.type = "button";
      go.className = "pwa-go";
      go.textContent = "Install app";
      go.addEventListener("click", function () {
        if (!deferred) { hide(); return; }
        deferred.prompt();
        deferred.userChoice.then(function () { deferred = null; hide(); });
      });
      var p = document.createElement("p");
      p.textContent = "Free, no app store. Works offline for pages you have opened.";
      bar.appendChild(go);
      bar.appendChild(p);
    } else {
      var hint = document.createElement("p");
      hint.innerHTML = "Install this app: tap <strong>Share</strong> " +
        "<span aria-hidden=\"true\">(\u2191 square)</span> then <strong>Add to Home Screen</strong>.";
      bar.appendChild(hint);
    }
    bar.appendChild(closeBtn());
    (document.body || document.documentElement).appendChild(bar);
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferred = e;
    show("prompt");
  });
  window.addEventListener("appinstalled", function () { deferred = null; remember(); hide(); });

  function iosHint() {
    if (isIOS() && !standalone()) show("ios");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iosHint);
  else iosHint();
})();
