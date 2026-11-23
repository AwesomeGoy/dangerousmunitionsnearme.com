(function () {
  const script = document.currentScript;
  const DATA_URL = (script && script.getAttribute("data-src")) || "data/sites.json";
  const ZCTA_URL = (script && script.getAttribute("data-zcta-src")) || "data/zcta-centroids.json";
  const form = document.getElementById("nearby-form");
  const zipInput = document.getElementById("nearby-zip");
  const geoBtn = document.getElementById("nearby-geo");
  const results = document.getElementById("nearby-results");
  if (!form || !zipInput || !results) return;

  let sites = null;
  let zctaTable = null;
  let zctaLoading = null;
  let sitesLoading = null;

  const toRad = (d) => (d * Math.PI) / 180;
  function miles(a, b) {
    const R = 3958.7613;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function setMessage(text, isError) {
    results.innerHTML = "";
    const p = document.createElement("p");
    p.className = isError ? "nearby-error" : "nearby-note";
    p.textContent = text;
    results.appendChild(p);
  }

  function loadSites() {
    if (sites) return Promise.resolve(sites);
    if (!sitesLoading) {
      sitesLoading = fetch(DATA_URL)
        .then((r) => {
          if (!r.ok) throw new Error("Could not load the site list.");
          return r.json();
        })
        .then((data) => {
          sites = data.sites || [];
          return sites;
        })
        .catch((err) => {
          sitesLoading = null;
          throw err;
        });
    }
    return sitesLoading;
  }

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

  function render(origin, label) {
    const located = (sites || []).filter((s) =>
      typeof s.latitude === "number" && typeof s.longitude === "number"
    ).map((s) => {
      const d = miles(origin, { lat: s.latitude, lon: s.longitude });
      return { site: s, miles: d };
    }).sort((a, b) => a.miles - b.miles);

    const closestFive = located.slice(0, 5);
    const within = located.filter((x) => x.miles <= 100);
    const seen = new Set(closestFive.map((x) => x.site.id));
    const extra = within.filter((x) => !seen.has(x.site.id));
    const list = closestFive.concat(extra);

    results.innerHTML = "";
    const h = document.createElement("h3");
    h.textContent = "Closest sites in this draft" + (label ? " — " + label : "");
    results.appendChild(h);
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "nearby-note";
      p.textContent = "No sites with sourced coordinates were found.";
      results.appendChild(p);
      return;
    }
    const ol = document.createElement("ol");
    list.forEach((item) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "sites/" + item.site.id + ".html";
      a.textContent = item.site.name;
      const meta = document.createElement("span");
      meta.className = "miles";
      const loc = [item.site.city, item.site.state].filter(Boolean).join(", ");
      meta.textContent = " — " + loc + " — " + item.miles.toFixed(1) + " straight-line miles";
      li.appendChild(a);
      li.appendChild(meta);
      ol.appendChild(li);
    });
    results.appendChild(ol);
    const note = document.createElement("p");
    note.className = "nearby-note";
    note.textContent = "Showing the closest five sites, plus any other dataset site within 100 straight-line miles. Distances are not driving distance and not a measure of risk.";
    results.appendChild(note);
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    const zip = (zipInput.value || "").trim();
    if (!/^\d{5}$/.test(zip)) {
      setMessage("Please enter a five-digit U.S. ZIP code.", true);
      zipInput.focus();
      return;
    }
    setMessage("Looking up that ZIP…");
    Promise.all([loadSites(), loadZcta()])
      .then(function (pair) {
        const table = pair[1];
        const coord = table[zip];
        if (!coord) {
          setMessage("ZIP " + zip + " does not have a Census ZCTA centroid in this table, so this draft cannot plot it. That is not a finding about risk. You can try a nearby ZIP or use the tracker map.", true);
          return;
        }
        const lat = Number(coord.lat != null ? coord.lat : coord[0]);
        const lon = Number(coord.lon != null ? coord.lon : coord[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          setMessage("That ZIP is in the table, but the coordinates could not be read.", true);
          return;
        }
        render({ lat: lat, lon: lon }, "ZIP " + zip);
      })
      .catch(function (err) {
        setMessage(err && err.message ? err.message : "The lookup failed.", true);
      });
  });

  if (geoBtn && navigator.geolocation) {
    geoBtn.addEventListener("click", function () {
      setMessage("Asking this browser for a location…");
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          loadSites()
            .then(function () {
              render(
                { lat: pos.coords.latitude, lon: pos.coords.longitude },
                "your browser location"
              );
            })
            .catch(function (err) {
              setMessage(err && err.message ? err.message : "The lookup failed.", true);
            });
        },
        function () {
          setMessage("This browser did not share a location. You can enter a ZIP code instead.", true);
        }
      );
    });
  } else if (geoBtn) {
    geoBtn.hidden = true;
  }
})();
