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
