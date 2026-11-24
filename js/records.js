
(function () {
  var form = document.getElementById("records-form");
  var preview = document.getElementById("letter-preview");
  if (!form || !preview) return;
  var routing = document.getElementById("routing");
  var sites = [];
  try {
    sites = JSON.parse(document.getElementById("records-sites-json").textContent || "[]");
  } catch (e) { sites = []; }
  var offices = {};
  try {
    offices = JSON.parse(document.getElementById("records-offices-json").textContent || "{}");
  } catch (e) { offices = {}; }

  function val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || "").trim() : "";
  }
  function siteById(id) {
    for (var i = 0; i < sites.length; i++) if (sites[i].id === id) return sites[i];
    return null;
  }
  function officeFor(site, kind) {
    var federal = (offices.federal || {});
    var key = "epa";
    if (site) {
      key = (offices.overrides || {})[site.id] || (offices.by_sector || {})[site.sector] || "epa";
    }
    if (kind === "state") {
      var st = site ? site.state : val("field-state");
      return (offices.states || {})[st] || null;
    }
    return federal[key] || federal.epa;
  }
  function today() {
    var d = new Date();
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  function buildLetter() {
    var kind = val("field-kind") || "foia";
    var site = siteById(val("field-site"));
    var requester = val("field-name") || "[Your name]";
    var address = val("field-address") || "[Your mailing address]";
    var email = val("field-email") || "[Your email]";
    var phone = val("field-phone") || "";
    var desc = val("field-desc") || "[Describe the records you want, including date ranges if you know them.]";
    var format = val("field-format") || "electronic copies, if available";
    var office = officeFor(site, kind);
    var agency = office ? (office.component || office.agency || office.law || "the agency") : "the agency";
    var officeAddr = office ? (office.address || office.portal || office.url || "") : "";
    var siteLine = site ? (site.name + (site.city || site.state ? " (" + [site.city, site.state].filter(Boolean).join(", ") + ")" : "") + (site.epa_id ? ", EPA ID " + site.epa_id : "")) : (val("field-site-other") || "[Name of the facility]");
    var law = kind === "state"
      ? ((office && (office.law || office.name)) || "the applicable state or territorial public-records law")
      : "the Freedom of Information Act, 5 U.S.C. § 552";
    var lines = [];
    lines.push(today());
    lines.push("");
    lines.push(agency);
    if (officeAddr) lines.push(officeAddr);
    lines.push("");
    lines.push("Re: Public records request — " + siteLine);
    lines.push("");
    lines.push("To whom it may concern:");
    lines.push("");
    lines.push("Under " + law + ", I request access to the following records:");
    lines.push("");
    lines.push(desc);
    lines.push("");
    lines.push("This request concerns " + siteLine + ".");
    lines.push("");
    lines.push("Please provide " + format + ". If you withhold any portion of a record, please identify the exemption you rely on and release all reasonably segregable parts. If any of these records are already publicly posted, a link to the official posting will suffice.");
    lines.push("");
    lines.push("I am a private individual seeking these records for public understanding of environmental and public-safety issues. If there are fees above $25, please contact me before processing. I ask that you waive or reduce fees to the extent the law allows.");
    lines.push("");
    lines.push("Thank you for your help.");
    lines.push("");
    lines.push("Sincerely,");
    lines.push(requester);
    lines.push(address);
    if (email) lines.push(email);
    if (phone) lines.push(phone);
    return lines.join("\n");
  }
  function showRouting() {
    if (!routing) return;
    var kind = val("field-kind") || "foia";
    var site = siteById(val("field-site"));
    var office = officeFor(site, kind);
    if (!office) {
      routing.innerHTML = "<p class=\"empty\">No sourced routing is recorded for this choice yet. Use the general letter and send it to the agency that holds the records.</p>";
      return;
    }
    var bits = [];
    bits.push("<dt>Where to send it</dt><dd>" + (office.component || office.agency || "") + "</dd>");
    if (office.law) bits.push("<dt>Law</dt><dd>" + office.law + "</dd>");
    if (office.url) bits.push("<dt>Official page</dt><dd><a href=\"" + office.url + "\">" + office.url + "</a></dd>");
    if (office.portal) bits.push("<dt>Portal or address</dt><dd>" + office.portal + "</dd>");
    if (office.notes) bits.push("<dt>Note</dt><dd>" + office.notes + "</dd>");
    routing.innerHTML = bits.join("");
  }
  function refresh() {
    preview.textContent = buildLetter();
    showRouting();
  }
  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);
  var copyBtn = document.getElementById("copy-letter");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var text = preview.textContent || "";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          copyBtn.textContent = "Copied";
          setTimeout(function () { copyBtn.textContent = "Copy letter"; }, 1500);
        });
      } else {
        var range = document.createRange();
        range.selectNodeContents(preview);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand("copy");
      }
    });
  }
  var printBtn = document.getElementById("print-letter");
  if (printBtn) printBtn.addEventListener("click", function () { window.print(); });
  refresh();
})();
