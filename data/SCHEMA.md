# Munitions Sites Tracker — data schema

Draft dataset for Dangerous Munitions Near Me. Canonical files live in this directory (`data/`). The public site under `site/` may lag these files and was not rebuilt in the expansion pass that added the `sector` field and the companion JSON files.

Byline: D.A. Williams. Status: DRAFT, not published. Dates and `last_checked` / `source_checked_date` values are America/Phoenix (UTC-7) calendar dates unless a source gives another zone.

Source rule: official or other allowed primary sources. This draft does not cite NYT, CNN, MSNBC/MS NOW, Fox News, Snopes, or PolitiFact. Blank fields mean no source, not a zero or a no.

Verification labels used across these files:

- **verified** — the listed facts were confirmed from official or other allowed primary sources.
- **partly verified** — official identity (and usually an EPA listing, permit notice, or documented incident) is confirmed, but inventory, current operations, some dates, or some incident details remain incomplete, or a notice was read only as a reproduction of an official text.
- **unverified** — a claim was recorded but not confirmed against a primary source.

---

## 1. `sites.json` and `sites.csv`

`sites.json` is an object with `meta` and `sites` (an array of site objects). `sites.csv` is a flattened table of the same sites, one row per site, with list fields joined as described below.

### `meta` (JSON only)

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | string | Dataset title. |
| `status` | string | Publication status (`DRAFT, not published`). |
| `byline` | string | `D.A. Williams`. |
| `homepage` | string | `https://awesomegoy.com`. |
| `created` | date | First build date. |
| `last_built` | date | Date the canonical files were last written. |
| `timezone_note` | string | How dates are recorded. |
| `inclusion_rule` | string | What is in the dataset and why. |
| `coordinate_policy` | string | Coordinates come from EPA FRS; they are not guessed or offset. |
| `verification_policy` | string | Definition of the three verification labels. |
| `source_exclusions` | string | Outlets this draft does not cite. |
| `epa_list_url` | string | EPA current OB/OD facilities page. |
| `epa_list_updated` | date | Date EPA gives for the table (`2025-03-11`). |
| `site_count` | number | Number of site records. |
| `excluded_from_epa_list_count` | number | Count of current EPA-list facilities still omitted (now 0). |
| `excluded_from_epa_list` | array | Those omitted EPA-list rows (now empty). |
| `still_excluded` | array of strings | What remains out of scope, including the unresolved EPA 65-vs-64 operating-count note and the RCRAInfo/ECHO gap. |
| `sector_counts` | object | Counts of sites by `sector`. |
| `data_note` | string | Provenance note for later editors. |

### Site object / CSV columns

| Field | JSON type | CSV notes | Meaning |
| --- | --- | --- | --- |
| `id` | string | | Stable slug used by other files (`site_id`). |
| `name` | string | | Display name. |
| `epa_name` | string | | Name as it appears on the EPA OB/OD table, when the site is on that list. |
| `sector` | string | | One of: `army`, `navy`, `air_force`, `marines`, `other_dod`, `doe`, `nasa`, `contractor`, `other`. `other_dod` is used for joint bases, Space Force, National Guard / state military department sites, and DoD ranges whose service is not stated in the EPA name. |
| `branch` | string | | More specific operator or service text when a source supports it; may be blank. |
| `state` | string | | Two-letter state or territory code. |
| `city` | string | | City from the EPA list or a sourced address. |
| `address` | string | | Street or location text from the EPA list or a sourced address. |
| `zip` | string | | Postal code as listed. |
| `latitude`, `longitude` | number or null | blank if none | EPA FRS `LATITUDE83` / `LONGITUDE83` for the site's RCRA ID when available. |
| `coordinate_source` | string | | Attribution, usually `EPA FRS RCRAINFO {epa_id} (NAD83)`. |
| `coordinate_method` | string | | FRS collection method, accuracy, and reference point when FRS provides them. |
| `epa_id` | string | | RCRA handler ID. |
| `epa_region` | string | not in CSV | EPA region number. |
| `type` | array of strings | joined with `; ` | High-level site types such as `OB/OD`, `demil`, `production`, `storage`. |
| `on_epa_obod_list` | boolean | `yes` / `no` | Whether the EPA ID appears on EPA's current OB/OD table. |
| `jmc_demil_hub` | boolean | `yes` / `no` | Whether a sourced JMC / demil briefing names this installation as a CONUS demil hub. |
| `permit_status` | string | | EPA-listed status, usually `Permitted` or `Interim Status`. |
| `permit_expiration` | string | | Expiration text as EPA lists it, including `Not applicable`. |
| `permit_expiration_iso` | string | not in CSV | ISO date when the listed expiration could be parsed; blank for `Not applicable` or unparsable text. |
| `known_energetics` | string | | Sourced description of energetics or munitions types; blank if none. |
| `current_status` | string | | Sourced operating / permit / closure status. |
| `notable_incidents` | array | see below | Incident objects; see the next subsection. |
| `research_depth` | string | | `basic` or `deep`. |
| `verification` | string | | Site-level label: `verified`, `partly verified`, or `unverified`. |
| `needs_research` | boolean | `yes` / `no` | Open research questions remain. |
| `notes` | string | | Caveats, gaps, and non-claim notes. |
| `sources` | array of `{title, url}` | URLs joined with ` \| ` | Supporting sources. |
| `last_checked` | date | | Date the record was last checked. |

CSV does not include `epa_region` or `permit_expiration_iso`; those remain in JSON.

### `notable_incidents` objects

Every incident object has:

| Field | Type | Meaning |
| --- | --- | --- |
| `date` | string | ISO date, or a partial ISO date such as `2012` or `2012-10`. |
| `description` | string | Short factual description. |
| `summary` | string | Same text as `description`, kept so earlier consumers of `summary` do not break. |
| `sources` | array | At least one URL. In `sites.json` this may be an array of URL strings (legacy) or `{title, url}` objects. |
| `verification` | string | `verified`, `partly verified`, or `unverified`. |

In `sites.csv`, incidents are joined with ` | ` as `date: description [verification]`.

---

## 2. `public_comments.json`

Object with `meta` and `comments`. Only official (or clearly reproduced official) notices are included. The file may be short; an empty `comments` array would be used rather than guessed items.

### `meta`

Includes `title`, `status`, `byline`, `homepage`, `last_built`, `scope`, `gaps` (array of strings describing searches that did not yield a retrievable official notice), and `count`.

### Comment object

| Field | Type | Meaning |
| --- | --- | --- |
| `site_id` | string | Matches `sites.json` `id`. |
| `permit_type` | string | Kind of permit named in the notice. |
| `action` | string | `renewal`, `modification`, `emergency permit`, `intent to issue`, or a short sourced variant of those. |
| `agency` | string | Issuing or noticing agency. |
| `comment_open` | date or `""` | Start of the comment, petition, or notice window, if stated. |
| `comment_close` | date or `""` | End of that window, if stated or clearly computable from the notice (for example, 45 days after a stated publication date). |
| `hearing_date` | date or `""` | Hearing date if one was scheduled in a retrieved notice. |
| `hearing_location` | string | Hearing location if stated. |
| `status` | string | `open`, `upcoming`, `closed`, or `unknown`. |
| `notice_url` | string | URL of the notice that was checked. |
| `source_checked_date` | date | Date that notice was checked. |
| `verification` | string | Same three labels as above. |

---

## 3. `incidents.json`

A flat, site-wide list derived from `notable_incidents` in `sites.json`. Object with `meta` and `incidents`, sorted ascending by date (incomplete dates sort at the start of their year or month), then `site_id`.

### Incident object

| Field | Type | Meaning |
| --- | --- | --- |
| `date` | string | ISO or partial ISO date. |
| `site_id` | string | Matches `sites.json` `id`. |
| `site_name` | string | Display name at the time of the export. |
| `description` | string | Short factual description. |
| `sources` | array of `{url}` or `{title, url}` | At least one URL. |
| `verification` | string | `verified`, `partly verified`, or `unverified`. |

---

## 4. `resident_guide.json`

Plain-language source guide for nearby residents. It is not medical, legal, or emergency advice; see `meta.disclaimer`.

### `meta`

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | string | Guide title. |
| `status` | string | `DRAFT, not published`. |
| `byline` | string | `D.A. Williams`. |
| `homepage` | string | `https://awesomegoy.com`. |
| `last_checked` | date | Date the linked official pages were checked. |
| `disclaimer` | string | Not medical or legal advice; official agency pages control filing rules. |

### Section object

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Stable section slug. |
| `title` | string | Section heading. |
| `points` | array | Point objects. |

### Point object

| Field | Type | Meaning |
| --- | --- | --- |
| `text` | string | Plain-language statement grounded in the cited official pages. |
| `sources` | array of `{title, url}` | Primary-source links for that point. |

Current section ids:

- `find-lepc-and-emergency-plan`
- `obod-emissions-and-health-sources`
- `foia-requests`
- `permit-notices`


## meta.credits
List of {name, url} cross-check sources to credit on the About page.

---

## 5. `canada_uxo.json` and `canada_uxo.csv`

Official National Defence inventory of UXO Legacy Sites in Canada, copied from the English Open Government XLSX. This is a companion dataset, not mixed into `sites.json` (the U.S. EPA OB/OD / munitions-sites set).

**Attribution:** Contains information licensed under the Open Government Licence – Canada. Publisher: National Defence. Licence: https://open.canada.ca/en/open-government-licence-canada. This project is not endorsed by the Government of Canada.

Portal record: https://open.canada.ca/data/en/dataset/de4c9c42-40ea-4069-91e3-1951206e3b60 (record ID `de4c9c42-40ea-4069-91e3-1951206e3b60`; DOI `OD-2017-00002`; source date modified 2026-06-26). A byte-for-byte copy of the official English file is stored at `data/sources/canada-dnd-uxo/uxo-open-source-data-en.xlsx`.

Coordinates are included only if the official XLSX or the DND locations page provides them. The June 26, 2026 English XLSX and the locations table do not publish latitude or longitude; those fields are left blank and are not geocoded from place names.

### `meta`

| Field | Type | Meaning |
| --- | --- | --- |
| `title` | string | Dataset title. |
| `status` | string | `DRAFT, not published`. |
| `byline` | string | `D.A. Williams`. |
| `homepage` | string | `https://awesomegoy.com`. |
| `last_built` | date | Date these files were written. |
| `timezone_note` | string | How dates are recorded. |
| `publisher` | string | `National Defence (Canada)`. |
| `dataset_name` | string | Official dataset title. |
| `dataset_record_id` | string | Open Government record ID. |
| `dataset_doi` | string | Portal DOI / unique identifier (`OD-2017-00002`). |
| `source_url` | string | Open Government dataset page. |
| `download_url_en` | string | Official English XLSX URL. |
| `download_url_fr` | string | Official French XLSX URL (not ingested in this pass). |
| `locations_page` | string | DND searchable locations page. |
| `program_page` | string | DND UXO Legacy Sites Program page (status and risk-process context). |
| `source_date_modified` | date | Date the portal gives for the source file (`2026-06-26`). |
| `source_date_published` | date | Portal "date published." |
| `record_released` | date | Portal "record released." |
| `licence` | string | `Open Government Licence – Canada`. |
| `licence_url` | string | Licence page. |
| `licence_version` | string | `2.0` as of the licence page checked on 2026-11-23. |
| `attribution` | string | Required attribution statement. |
| `attribution_note` | string | Non-endorsement and official-symbol reminder. |
| `coordinate_policy` | string | Official coordinates only; none were published in the XLSX or locations table. |
| `verification_policy` | string | How labels are used for this file. |
| `source_file` | string | Path to the stored official XLSX. |
| `source_file_bytes` | number | Size of that official file (46,704). |
| `record_count` | number | Number of site records (854). |
| `status_counts` | object | Counts by official `Status` value. |
| `province_counts` | object | Counts by official `Province` code, including `EC` and `WC`. |
| `status_notes` | object | Sourced DND program-page context for portfolio classes, risk levels (not in the XLSX), and what `Closed` means. |
| `coverage_note` | string | XLSX vs locations-page row difference, and unexpanded `EC`/`WC` codes. |
| `inclusion_rule` | string | Every official English XLSX row is included. |

### Site object / CSV columns

| Field | JSON type | CSV notes | Meaning |
| --- | --- | --- | --- |
| `id` | string | | Stable slug: `canada-` plus the lowercase primary site ID (for example `canada-ab900-001`). |
| `site_id` | string | | Full official identifier, for example `AB900-001 / 0539-X001`. |
| `site_id_primary` | string | | The first official ID (`AB900-001`). |
| `site_id_secondary` | string | | The second official ID (`0539-X001`). |
| `name` | string | | Site name as published in the English XLSX (some names repeat the primary ID). |
| `province` | string | | Official `Province` code as published. The DND locations page labels the same codes `Coast`. Values include standard province and territory codes plus `EC` and `WC`, which are not expanded here because an official definition was not retrieved. |
| `status` | string | | Official status as published: `In Assessment`, `Assessment Complete`, `Risk Mitigation Ongoing`, or `Closed`. |
| `latitude`, `longitude` | number or `null` | blank | Official coordinates when published. Currently blank for every record. |
| `coordinate_source` | string | | Attribution for coordinates when present; currently blank. |
| `sources` | array of `{title, url}` | URL(s) joined with ` \| ` | The Open Government dataset page. |
| `verification` | string | | `verified` for ID, name, province, and status copied from the official XLSX. |
| `last_checked` | date | | Date the official file was checked. |

---

## 6. `canada_sites.json` and `canada_sites.csv`

Builder-facing Canada file for the Canada section at dangerousmunitionsnearme.com/canada/. Thor’s builder auto-loads `data/canada_sites.json`. **Do not mix these records into the U.S. `sites.json`.** The official-inventory extract `canada_uxo.json` / `canada_uxo.csv` is unchanged and remains the attribution copy of the Open Government XLSX (no inferred coordinates).

`canada_sites.json` is an object with `meta` and `sites`. `canada_sites.csv` is a flattened table of the same sites, one row per site, using the same list-joining conventions as `sites.csv` (`type` joined with `; `, incident text with ` | `, source URLs with ` | `, booleans `yes` / `no`).

Site objects use the **same fields as `sites.json`**, plus the Canada fields below. U.S. EPA-only fields are present so a shared builder can read both files; they are blank or `false` for Canada records.

### Extra Canada fields (and `state` compatibility)

| Field | JSON type | CSV notes | Meaning |
| --- | --- | --- | --- |
| `province` | string | | Official province, territory, or coast code from the DND inventory for legacy rows (`AB`, `BC`, `MB`, `NB`, `NL`, `NS`, `NT`, `NU`, `ON`, `PE`, `QC`, `SK`, `YT`, plus `EC` and `WC`, which are not expanded here). Active DND rows use the standard province code of the installation. |
| `state` | string | | **Same value as `province`.** Kept so a builder that already reads `state` from the U.S. schema does not need a special case. |
| `coord_precision` | string | | `exact` — a published official coordinate of the site itself (for example a Federal Contaminated Sites Inventory point for a named range). `place_name_approx` — official NRCan CGNDB named-feature point for a uniquely matched place, base, or training-area name; not a surveyed footprint. `none` — latitude and longitude left blank. This pass uses only `place_name_approx` and `none`. |
| `coord_source` | string | | URL of the official coordinate source, usually the CGNDB geoname JSON record (for example `https://geogratis.gc.ca/services/geoname/en/geonames/IAQFR.json`). Blank when `coord_precision` is `none`. |
| `coordinate_source`, `coordinate_method` | string | | Human-readable attribution and method, as in the U.S. schema. |
| `dnd_site_id` | string | | Full official UXO inventory identifier, for example `AB900-001 / 0539-X001`. Blank on added active DND records that are not a single XLSX row. |
| `site_id_primary`, `site_id_secondary` | string | | The two official ID parts (`AB900-001`, `0539-X001`). Blank on added active DND records. |
| `public_comment_status`, `public_comment_open`, `public_comment_close`, `public_comment_url` | string | | Filled only when an official consultation is **open** at `last_checked`. As of 2026-11-23 no open official comment period was found; recently closed IAAC assessments (including Shearwater 90236 and Valcartier 90825) are described in `current_status` / `notes` instead. |

### Fields used the same way as `sites.json`

`id`, `name`, `branch`, `city`, `address`, `zip`, `latitude`, `longitude`, `type`, `known_energetics`, `current_status`, `notable_incidents`, `research_depth`, `verification`, `needs_research`, `notes`, `sources`, `last_checked`, `sector`, plus the EPA/permit fields listed in section 1 (blank or `false` here).

Canada `sector` values:

- `legacy_uxo` — official DND UXO Legacy Sites inventory row (854 records). `current_status` is the official XLSX Status value (`In Assessment`, `Assessment Complete`, `Risk Mitigation Ongoing`, or `Closed`). `verification` is `partly verified` (official record confirmed; location is not a surveyed site point). `research_depth` is `basic` except for a small Debert cluster that was researched further.
- `dnd` — active or proposed Department of National Defence / Canadian Armed Forces range, training area, proving ground, EOD/demolition area, or ammunition depot, added only from primary Government of Canada sources.
- `contractor` — reserved for industrial or contractor energetics disposal sites documented from primary Government of Canada sources. None were added in this pass.

### Coordinate rules (do not relax in the builder)

- Do not treat a CGNDB place-name or military-feature point as the site footprint.
- Do not guess among multiple official same-name places in the same province (or, for `EC`/`WC`, in Canada).
- Leave water-body, offshore, wreck, and dump-site names blank unless an official source gives coordinates for that site.
- `last_checked` / `last_built` are America/Phoenix (UTC-7) calendar dates.

### `meta` notes for this file

Includes `site_count`, `legacy_uxo_count`, `active_dnd_count`, `contractor_count`, `deep_count`, `records_with_coordinates`, `legacy_records_with_coordinates`, `coord_precision_counts`, `sector_counts`, Open Government Licence attribution, `coordinate_policy`, `public_comments_note`, and `coverage_gaps`. Required attribution: “Contains information licensed under the Open Government Licence – Canada.”
