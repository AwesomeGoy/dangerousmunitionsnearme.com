/* fl-strings.js — every user-facing string for lookup.html and factsheet.html.
 * Translation hook: add FL_STRINGS.<lang> = { ...same keys... }. Missing keys fall back to English.
 * Language is taken from localStorage "dmnm-lang", then <html lang>, then "en".
 * Placeholders use {name}. Keep HTML out of strings (the code escapes everything). */
window.FL_STRINGS = window.FL_STRINGS || {};
window.FL_STRINGS.en = {
  site_name: "Dangerous Munitions Near Me",
  skip: "Skip to main content",
  byline: "By D.A. Williams",
  not_official: "Not an official government document.",
  site_url: "dangerousmunitionsnearme.com",

  lookup_title: "What's near me? Worldwide hazard lookup",
  lookup_lede: "Type a place, address, ZIP or postal code, or use your device location. We list every mapped hazard record in this database within the distance you choose, nearest first.",
  privacy_title: "What happens to the place you type",
  privacy_body: "When you press Search, the place, address, ZIP or postal code you typed is sent to a third-party place-search service to turn it into coordinates: OpenStreetMap Nominatim (run by the OpenStreetMap Foundation), and Photon (run by Komoot) if Nominatim does not answer. Those services receive what you typed and your internet (IP) address, under their own privacy policies. This site does not store, log or share what you type or your location, does not keep the search replies, and never puts your location in the page address or in analytics. If you use “Use my location” instead, your device location stays in your browser and nothing is sent to those services.",
  privacy_map: "The map is off until you open it. When you open it, map pictures for the area shown are loaded from the OpenStreetMap tile servers, which can see which area is being viewed.",
  label_place: "Place, address, ZIP or postal code",
  hint_place: "Examples: Phoenix, AZ · Middletown, Iowa · B3H 4R2 · Kyiv",
  btn_search: "Search",
  btn_geo: "Use my location",
  label_radius: "Distance",
  label_unit: "Units",
  unit_mi: "miles",
  unit_km: "kilometres",
  unit_mi_short: "mi",
  unit_km_short: "km",
  status_geocoding: "Looking up “{q}”…",
  status_geo: "Asking your device for its location…",
  status_loading: "Loading hazard records near {place}…",
  status_done: "{n} mapped records within {r} {u} of {place}.",
  status_none: "No mapped records within {r} {u} of {place}. Try a larger distance.",
  err_empty: "Type a place, address, ZIP or postal code first.",
  err_notfound: "We could not find “{q}”. Check the spelling or add the country, for example “Springfield, Illinois, USA”.",
  err_geocoder: "The place-search service did not answer. Wait a few seconds and try again, or use your device location.",
  err_geo_denied: "Location permission was not given. You can type a place instead.",
  err_geo_unavail: "Your device could not find its location. You can type a place instead.",
  err_data: "Some hazard data could not be loaded. Results may be incomplete; please try again.",
  choose_place: "More than one place matched. Choose one:",
  your_location: "your location",
  results_heading: "Results",
  results_sorted: "Nearest first. Distances are straight-line, measured to the mapped point or to the edge of a mapped area.",
  inside_area: "You are inside this mapped area",
  distance: "{d} {u} away",
  area_admin_note: "Stand-in area: this is the whole province, district or country where contamination is reported, not the hazard’s real outline.",
  approx_note: "Approximate location (for example a town, airfield or area centre), not the exact site.",
  area_outline_note: "Mapped area outline.",
  layer: "Type",
  source_layer: "Dataset",
  status: "Status",
  verification: "Checked",
  open_sheet: "Fact sheet",
  open_record: "Record page",
  open_layer: "Dataset page",
  show_more: "Show {n} more",
  showing: "Showing {a} of {b}",
  map_show: "Show map",
  map_hide: "Hide map",
  map_label: "Map of results. The numbered list above has the same information.",
  map_you: "Search centre",
  map_group: "{n} records at the same mapped point (from no. {first})",
  map_attrib: "Map data © OpenStreetMap contributors",
  listonly_title: "Records that cannot be distance-matched",
  listonly_body: "{n} of the {total} records in this database have no published coordinates (“list-only”). We never guess locations, so these cannot appear in a distance search even if they are near you. Browse them on each dataset page.",
  listonly_table_src: "Dataset",
  listonly_table_n: "List-only records",
  geocoder_attrib: "Place search © OpenStreetMap contributors, via Nominatim (ODbL). Backup: Photon by Komoot.",
  caveat: "This list shows what is in this database, not every hazard that exists. A record nearby does not mean you are at risk, and no record does not mean an area is safe. In an emergency follow local officials.",

  v_verified: "Verified against official sources",
  v_corrected: "Verified; an official source corrected an earlier detail",
  v_unverified: "Not fully verified; kept for context",
  "v_partly verified": "Partly verified",
  v_register: "Copied from an official register (not individually re-checked)",
  v_none: "Verification status not recorded",

  sheet_title: "Fact sheet",
  sheet_print: "Print or save as PDF",
  sheet_back: "Back to lookup",
  sheet_loading: "Loading record…",
  sheet_notfound: "That record was not found. It may have been renamed or removed.",
  sheet_location: "Location",
  sheet_coords: "Coordinates",
  sheet_coords_none: "No published coordinates (list-only record)",
  sheet_coord_note: "Coordinate note",
  sheet_what: "What happened / what this is",
  sheet_what_none: "No summary in the record.",
  sheet_hazard: "Hazard type",
  sheet_risk: "What this means for you",
  sheet_verification: "Verification status",
  sheet_status: "Current status",
  sheet_figures: "Key figures",
  sheet_sources: "Official sources",
  sheet_sources_none: "No source listed in this record.",
  sheet_checked: "Date checked",
  sheet_date: "Date",
  sheet_more_online: "Shortened to fit one page. Full text online: scan the QR code.",
  sheet_sources_more: "+ {n} more sources online (scan the QR code).",
  sheet_qr: "Scan to open this record online",
  sheet_record_id: "Record ID",
  sheet_disclaimer: "Summary of public official records compiled by D.A. Williams. Not medical, legal or emergency advice. In an emergency follow local officials.",

  risk_munitions: "Explosives are stored, tested or destroyed here. Open burning or detonation can send smoke and chemicals downwind. Watch for official notices and follow local emergency instructions.",
  risk_uxo: "Old explosives (unexploded bombs, shells or landmines) may be in the ground or water here. Never touch, move or collect metal objects. Note the spot, walk away the way you came, and report it to police or emergency services.",
  risk_explosion: "A major explosion or fire happened here. Leftover explosives or chemicals may remain. Stay out of fenced or signed areas and follow official guidance.",
  risk_spill: "A major oil spill happened here. Oil can stay in soil, sand, sediment and water for years. Follow local advice on fishing, swimming and drinking water.",
  risk_contamination: "Soil, water or air here has been contaminated. Risk mostly comes from contact: drinking well water, eating local fish or game, or digging. Check official advisories.",
  risk_chemical: "A chemical-plant disaster happened here. Most acute danger is over, but some chemicals can persist in soil and water. Check official health and cleanup notices.",
  risk_chemweapons: "Chemical weapons were stored, destroyed, dumped or released here. Never touch old shells or drums, on land or washed up from the sea. Report finds to police.",
  risk_seadump: "Munitions were dumped in the sea here. Items can wash ashore or be caught in nets. Do not touch unusual objects on beaches; report them to the coastguard or police.",
  risk_nuclear: "Radioactive material was released, stored or cleaned up here. Follow official access limits and advice about local food, water and land use.",
  risk_nucleartest: "Nuclear weapons were tested here. Some ground may still be radioactive or off-limits. Respect fences and signs and follow official advice.",
  risk_uranium: "This is an abandoned uranium mine. Waste rock and water nearby can contain radiation and metals. Do not use the water or materials, and keep animals away.",
  risk_mining: "Mining here left waste, tailings or polluted water. Dams can fail and runoff can carry metals. Follow advice on water, fishing and dam emergency plans.",
  risk_pfas: "PFAS (“forever chemicals”) from firefighting foam were used here. The main concern is drinking water. Check whether your water supplier or well has been tested.",
  risk_superfund: "This is a U.S. EPA Superfund cleanup site. Exposure depends on the site; check EPA’s site page for current cleanup and health advice.",
  risk_range: "This is a firing or bombing range. Live fire and unexploded ordnance can be present. Never enter closed areas; obey signs and range schedules.",
  risk_military: "This is a military base or station, listed for context. Hazards depend on activities there; see the record and official sources.",
  risk_formerdefense: "Former military property. The U.S. Army Corps of Engineers lists no cleanup projects here; it is shown for history. If you find anything that looks like old ammunition, do not touch it and call 911.",
  risk_mixed: "See the record and its official sources for what this hazard means locally.",

  cat_munitions: "Munitions facility", cat_uxo: "Unexploded ordnance / landmines", cat_explosion: "Explosion or fire", cat_spill: "Oil spill",
  cat_contamination: "Contamination", cat_chemical: "Chemical-plant disaster", cat_chemweapons: "Chemical weapons", cat_seadump: "Sea-dumped munitions",
  cat_nuclear: "Nuclear or radiological", cat_nucleartest: "Nuclear test site", cat_uranium: "Uranium mine", cat_mining: "Mining waste",
  cat_pfas: "PFAS (forever chemicals)", cat_superfund: "Superfund site", cat_range: "Firing or bombing range", cat_military: "Military site", cat_formerdefense: "Former defense site (no cleanup projects)", cat_mixed: "Hazard"
};
(function () {
  var lang = "en";
  try { lang = localStorage.getItem("dmnm-lang") || document.documentElement.lang || "en"; } catch (e) { lang = document.documentElement.lang || "en"; }
  lang = (lang || "en").toLowerCase();
  if (!window.FL_STRINGS[lang]) lang = lang.split("-")[0];
  if (!window.FL_STRINGS[lang]) lang = "en";
  window.FL_LANG = lang;
  window.flT = function (key, vars) {
    var s = (window.FL_STRINGS[lang] && window.FL_STRINGS[lang][key]) || window.FL_STRINGS.en[key];
    if (s === undefined) return key;
    return s.replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] !== undefined ? vars[k] : "{" + k + "}"; });
  };
  window.flApplyStatic = function (root) {
    (root || document).querySelectorAll("[data-t]").forEach(function (el) { el.textContent = window.flT(el.getAttribute("data-t")); });
    (root || document).querySelectorAll("[data-t-attr]").forEach(function (el) {
      el.getAttribute("data-t-attr").split(";").forEach(function (pair) { var p = pair.split(":"); if (p.length === 2) el.setAttribute(p[0], window.flT(p[1])); });
    });
  };
})();
