/* Email alerts + report-a-site form. Sends nothing unless the form has data-endpoints-enabled="true". No dependencies. */
(function () {
  "use strict";
  if (window.__dmnmAtBound) return;
  window.__dmnmAtBound = true;

  function loadStrings() {
    var el = document.getElementById("dmnm-alerts-tips-strings");
    if (el) {
      try { return JSON.parse(el.textContent); } catch (e) { return null; }
    }
    return null;
  }

  var S = loadStrings() || {};
  function t(path, vars) {
    var cur = S, parts = path.split("."), i;
    for (i = 0; i < parts.length; i++) {
      if (!cur || typeof cur !== "object") { cur = path; break; }
      cur = cur[parts[i]];
    }
    if (typeof cur !== "string") cur = path;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        cur = cur.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
      });
    }
    return cur;
  }

  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function validZip(v) { return /^\d{5}$/.test(v); }
  function num(v) {
    if (v === "" || v === null || v === undefined) return null;
    var n = parseFloat(String(v).trim());
    return isFinite(n) ? n : NaN;
  }

  function setStatus(el, msg, kind) {
    if (!el) return;
    if (!msg) {
      el.setAttribute("hidden", "hidden");
      el.textContent = "";
      el.className = "status";
      return;
    }
    el.removeAttribute("hidden");
    el.className = "status is-" + (kind || "info");
    el.textContent = msg;
    if (kind === "error") el.setAttribute("role", "alert");
    else el.setAttribute("role", "status");
    try { el.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    catch (e) { if (el.scrollIntoView) el.scrollIntoView(); }
  }

  function setInvalid(input, invalid, describedBy) {
    if (!input) return;
    if (invalid) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
    if (describedBy) input.setAttribute("aria-describedby", describedBy);
  }

  function clearFieldErrors(form) {
    var nodes = form.querySelectorAll("[aria-invalid='true']");
    for (var i = 0; i < nodes.length; i++) nodes[i].removeAttribute("aria-invalid");
  }

  function isPreview(form) {
    return form.getAttribute("data-draft-mode") === "true" ||
      form.getAttribute("data-endpoints-enabled") !== "true";
  }

  function isOpen(form) {
    return form.getAttribute("data-form-open") === "true";
  }

  function honeyFilled(form) {
    var h = form.querySelector("[data-honeypot]");
    return !!(h && String(h.value || "").trim());
  }

  /* ---- Alerts ---- */
  function readCoords(form) {
    var lat = num((form.querySelector("[data-xalerts-lat]") || {}).value);
    var lon = num((form.querySelector("[data-xalerts-lon]") || {}).value);
    if (lat === null && lon === null) return { ok: true, empty: true };
    if (lat === null || lon === null || isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return { ok: false };
    }
    return { ok: true, empty: false, lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
  }

  function formatPoint(lat, lon, accuracy) {
    var la = Number(lat).toFixed(2);
    var lo = Number(lon).toFixed(2);
    if (accuracy !== null && accuracy !== undefined && isFinite(accuracy)) {
      return t("alerts.location_set", { lat: la, lon: lo, accuracy: String(Math.round(accuracy)) });
    }
    return t("alerts.location_set_no_accuracy", { lat: la, lon: lo });
  }

  function handleGeo(form) {
    var status = form.querySelector("[data-xalerts-status]");
    var latIn = form.querySelector("[data-xalerts-lat]");
    var lonIn = form.querySelector("[data-xalerts-lon]");
    var readout = form.querySelector("[data-location-readout]");
    if (!navigator.geolocation) {
      setStatus(status, t("alerts.error_geo_unsupported"), "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var la = pos.coords.latitude;
      var lo = pos.coords.longitude;
      if (latIn) latIn.value = String(la.toFixed(2));
      if (lonIn) lonIn.value = String(lo.toFixed(2));
      if (readout) {
        readout.hidden = false;
        readout.textContent = formatPoint(la, lo, pos.coords.accuracy);
      }
      setStatus(status, "", "info");
    }, function (err) {
      var msg = (err && err.code === 1) ? t("alerts.error_geo_denied") : t("alerts.error_geo_unavailable");
      setStatus(status, msg, "error");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }

  function clearGeo(form) {
    var latIn = form.querySelector("[data-xalerts-lat]");
    var lonIn = form.querySelector("[data-xalerts-lon]");
    var readout = form.querySelector("[data-location-readout]");
    if (latIn) latIn.value = "";
    if (lonIn) lonIn.value = "";
    if (readout) {
      readout.hidden = false;
      readout.textContent = t("alerts.location_cleared");
    }
  }

  function handleAlertsSubmit(form) {
    var status = form.querySelector("[data-xalerts-status]");
    var emailIn = form.querySelector("[data-xalerts-email]");
    var zipIn = form.querySelector("[data-xalerts-zip]");
    var btn = form.querySelector("button[type='submit']");
    var email = ((emailIn && emailIn.value) || "").trim();
    var zip = ((zipIn && zipIn.value) || "").trim();
    var coords = readCoords(form);
    var statusId = status && status.id;

    clearFieldErrors(form);
    if (!isOpen(form)) {
      setStatus(status, t("alerts.error_not_open"), "error");
      return;
    }
    if (honeyFilled(form)) {
      setStatus(status, t(isPreview(form) ? "alerts.preview_success" : "alerts.success"), "ok");
      return;
    }
    if (!validEmail(email)) {
      setInvalid(emailIn, true, statusId);
      setStatus(status, t("alerts.error_email"), "error");
      if (emailIn) emailIn.focus();
      return;
    }
    if (zip && !validZip(zip)) {
      setInvalid(zipIn, true, statusId);
      setStatus(status, t("alerts.error_zip"), "error");
      if (zipIn) zipIn.focus();
      return;
    }
    if (!coords.ok) {
      var latIn = form.querySelector("[data-xalerts-lat]");
      setInvalid(latIn, true, statusId);
      setInvalid(form.querySelector("[data-xalerts-lon]"), true, statusId);
      setStatus(status, t("alerts.error_coords"), "error");
      if (latIn) latIn.focus();
      return;
    }
    if (!zip && coords.empty) {
      setInvalid(zipIn, true, statusId);
      setStatus(status, t("alerts.error_location"), "error");
      if (zipIn) zipIn.focus();
      return;
    }

    if (isPreview(form)) {
      setStatus(status, t("alerts.preview_success"), "ok");
      return;
    }
    /* Live path: only when data-endpoints-enabled="true". */
    if (btn) btn.disabled = true;
    setStatus(status, t("alerts.submitting"), "info");
    var action = form.getAttribute("action") || "";
    var body = new URLSearchParams();
    body.set("fields[email]", email);
    if (zip) body.set("fields[z_i_p]", zip);
    var place = ((form.querySelector("[data-xalerts-place]") || {}).value || "").trim();
    var radius = ((form.querySelector("[data-xalerts-radius]") || {}).value || "50").trim();
    if (place) body.set("fields[dmnm_place]", place);
    body.set("fields[dmnm_radius]", radius);
    if (!coords.empty) {
      body.set("fields[dmnm_lat]", String(coords.lat));
      body.set("fields[dmnm_lon]", String(coords.lon));
    }
    body.set("fields[dmnm_source]", "dmnm");
    body.set("ml-submit", "1");
    body.set("anticsrf", "true");
    fetch(action, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: body.toString()
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res || !res.success) {
        var fe = res && res.errors && res.errors.fields;
        setStatus(status, (fe && fe.email && fe.email[0]) || (res && res.message) || t("alerts.error_network"), "error");
        return;
      }
      setStatus(status, t("alerts.success"), "ok");
      form.setAttribute("data-xalerts-done", "true");
    }).catch(function () {
      if (btn) btn.disabled = false;
      setStatus(status, t("alerts.error_network"), "error");
    });
  }

  /* ---- Tips ---- */
  function handleTipsSubmit(form) {
    var status = form.querySelector("[data-tips-status]");
    var placeIn = form.querySelector("[data-tips-place]");
    var whatIn = form.querySelector("[data-tips-what]");
    var emailIn = form.querySelector("[data-tips-email]");
    var confirmIn = form.querySelector("[data-tips-confirm]");
    var btn = form.querySelector("button[type='submit']");
    var place = ((placeIn && placeIn.value) || "").trim();
    var what = ((whatIn && whatIn.value) || "").trim();
    var email = ((emailIn && emailIn.value) || "").trim();
    var statusId = status && status.id;

    clearFieldErrors(form);
    if (!isOpen(form)) {
      setStatus(status, t("tips.error_not_open"), "error");
      return;
    }
    if (honeyFilled(form)) {
      setStatus(status, t(isPreview(form) ? "tips.preview_success" : "tips.success"), "ok");
      return;
    }
    if (!place) {
      setInvalid(placeIn, true, statusId);
      setStatus(status, t("tips.error_place"), "error");
      if (placeIn) placeIn.focus();
      return;
    }
    if (!what) {
      setInvalid(whatIn, true, statusId);
      setStatus(status, t("tips.error_what"), "error");
      if (whatIn) whatIn.focus();
      return;
    }
    if (email && !validEmail(email)) {
      setInvalid(emailIn, true, statusId);
      setStatus(status, t("tips.error_email"), "error");
      if (emailIn) emailIn.focus();
      return;
    }
    if (!confirmIn || !confirmIn.checked) {
      setInvalid(confirmIn, true, statusId);
      setStatus(status, t("tips.error_confirm"), "error");
      if (confirmIn) confirmIn.focus();
      return;
    }

    if (isPreview(form)) {
      setStatus(status, t("tips.preview_success"), "ok");
      return;
    }

    if (btn) btn.disabled = true;
    setStatus(status, t("tips.submitting"), "info");
    /* Native POST to FormSubmit (full navigation) only when endpoints are enabled. */
    form.submit();
  }

  document.addEventListener("click", function (ev) {
    var geoBtn = ev.target.closest && ev.target.closest("[data-use-location]");
    if (geoBtn) {
      ev.preventDefault();
      var form = geoBtn.form || geoBtn.closest("form");
      if (form) handleGeo(form);
      return;
    }
    var clearBtn = ev.target.closest && ev.target.closest("[data-clear-location]");
    if (clearBtn) {
      ev.preventDefault();
      var form2 = clearBtn.form || clearBtn.closest("form");
      if (form2) clearGeo(form2);
    }
  });

  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    if (!form || !form.getAttribute) return;
    if (form.getAttribute("data-xalerts-form") === "true") {
      ev.preventDefault();
      handleAlertsSubmit(form);
    } else if (form.getAttribute("data-tips-form") === "true") {
      ev.preventDefault();
      handleTipsSubmit(form);
    }
  }, true);
})();
