# Sonar Catch

A browser extension companion to [Sonar](https://github.com/Aryantyagi-2003/Sonar) (a
personal job-search tracker). While browsing Indeed's search results, Sonar Catch detects
the specific job posting currently open in the right-hand detail pane, extracts just that
listing's text, and sends it to Sonar's ingestion API for Gemini-backed classification.

It does not scrape, apply, or automate anything beyond that one action, and it never
touches the left-hand results list.

Ships for both **Chrome** and **Firefox** from one shared codebase — see **Cross-browser
support** below for exactly what differs between the two builds and why.

## Why this is a separate repo

Same reasoning as keeping any browser extension separate from its host app: it's a
distinct distributable artifact (a `.zip` you load into Chrome, not a page Sonar serves)
with its own build, its own permissions model, and its own release cadence.

## How it works

*(This section describes the Indeed path. See **Non-Indeed career sites** below for the
additive per-company adapters that reuse everything from step 3 onward.)*

1. A content script runs on `indeed.com` job search pages.
2. It locates the right-hand detail pane (see **Detection strategy** below), watches it
   with a debounced `MutationObserver`, and re-extracts whenever the pane's content
   changes — i.e. whenever you click a different job card.
3. A small floating widget shows **Send to Sonar** whenever a posting is currently
   detected, and visibly pulses on every change so you can tell it's tracking the posting
   you're looking at right now, not one from a few clicks ago.
4. Clicking it sends the extracted text to Sonar's `/api/ingest` endpoint, which runs it
   through the *exact same* Gemini extraction Sonar's own paste-a-posting form uses — no
   parallel extraction path.
5. Sonar returns the classification (company, role, pay, fit verdict, etc.) without
   saving anything yet. The widget shows a **Save** confirmation with that summary;
   clicking it hits `/api/ingest/confirm`, which actually creates the `Application` row.

That two-step flow is deliberate: this extension's own extraction can fall back to a
structural heuristic (see below) rather than a confirmed selector match, which is a real
step down in reliability from a human pasting text they already read. Auto-creating from
that would risk silently polluting your tracker with a bad extraction — the explicit
confirm step keeps a human in the loop, cheaply.

## Detection strategy — and its limits

Indeed's DOM is not a public API. Class names and `data-testid` attributes are
implementation details that change without notice. The selectors in
[`src/core/indeed/selectors.ts`](src/core/indeed/selectors.ts) were cross-referenced
across multiple independently-maintained, currently-live tools that target this same
split-view page, plus class names visible in Indeed's own shipped CSS, then **verified
2026-08-20 against a real, live Indeed search page in a real browser** (see that file's
header comment for exactly what was and wasn't confirmed). One selector guess
(`.jobsearch-ViewJobLayout` for the detail-pane wrapper) turned out to be stale on the
real page — the actual class is `.jobsearch-RightPane` — and has been corrected. That
same live run is also what the structural-fallback tier below was actually observed
falling into and recovering from, not just unit-tested in the abstract.

This is still a snapshot in time, not a permanent guarantee — see below.

**This extension will break when Indeed changes their markup.** That is a known,
permanent limitation of depending on an unofficial page structure instead of a real API —
not a bug that will eventually get fixed away. When it happens, extraction degrades in
three tiers rather than failing silently:

1. **Semantic selectors** — known `data-testid`/class names for the detail pane, title,
   company, location, salary, and description.
2. **Structural fallback** — if the pane's own wrapper selector is stale, falls back to
   "the largest block of text on the page that isn't inside the left-hand list." This is
   explicitly weaker (no title/company selectors to rely on either), and the extracted
   posting is tagged `containerTier: "structural"` so the rest of the pipeline always
   knows which tier produced it.
3. **Fail visibly** — if neither tier finds a plausible posting (a length threshold on the
   description text), the widget shows *"couldn't detect a job posting here"* rather than
   sending blank or garbage text to Sonar.

A `MutationObserver` on the detail pane (debounced 400ms) is what detects a different job
card being clicked — Indeed's split view swaps the pane's content in place, not via page
navigation, so an on-load-only hook would never see the change. Removal of Indeed's
loading skeleton (`jobsearch-ViewJobSkeleton` / `viewJob-skeleton`) is treated as an early
signal that new content just finished rendering, which shortens perceived latency instead
of always waiting the full debounce window.

## Architecture

Same core/adapter split as the rest of this project's browser-extension work:

- **`src/core/`** — pure TypeScript. No `chrome.*` APIs, no ambient DOM globals beyond a
  `Document` passed in as an argument. Fully unit-testable with `jsdom`, no real browser
  needed.
  - `indeed/extract.ts` + `indeed/selectors.ts` — the detection/extraction logic itself.
  - `sonar-client.ts` — talks to Sonar's `/api/ingest` and `/api/ingest/confirm`, with
    `fetch` injected for testability.
  - `compose-posting-text.ts` — reassembles title/company/location/salary/description
    into the same shape a human paste would have (Sonar's Gemini prompt expects that
    shape, not a bare description paragraph).
- **`src/adapters/webextension/`** — everything that touches `browser.*`/`chrome.*` APIs
  or the DOM as a live document: the content script (MutationObserver wiring, the injected
  widget), the background script (does the actual network calls, so they run with the
  extension's granted host permissions rather than the page's), `browser.storage.local`
  access, and the options page. One codebase, shared by both the Chrome and Firefox
  builds — see **Cross-browser support**.

## Cross-browser support

Chrome and Firefox both implement the WebExtensions API, but not identically. What's
actually different between them, and what stayed the same:

**Portable as-is (no changes needed):**
- All of `src/core/` — pure detection/extraction/API-client logic never touched a
  browser API to begin with.
- Standard manifest fields: `name`, `version`, `icons`, `action`, `options_page`,
  `content_scripts` (matches/js/css/run_at), `host_permissions`, `permissions`,
  `optional_host_permissions`.

**Made portable via `webextension-polyfill`:**
- Every `src/adapters/webextension/*` file used to call `chrome.*` directly (callback-based,
  Chrome-only). They now import `browser` from `webextension-polyfill` and call
  `browser.*` instead — Firefox implements `browser.*` natively (promise-based), and the
  polyfill adds the same promise-based `browser` global to Chrome by wrapping its
  `chrome.*` callbacks. Same adapter code, both browsers, no `if (isFirefox)` branches
  anywhere in the source.

**Genuinely different, handled by two separate build outputs:**
- **`background.service_worker`** (Chrome's MV3 background model) **has no Firefox
  equivalent** — confirmed against MDN, Firefox does not support the `service_worker` key
  at all and instead runs `background.scripts` as a non-persistent event page. The two
  manifests declare their background block differently; the underlying `background.ts`
  source is identical either way.
- **`browser_specific_settings.gecko`** — Firefox-only block (extension ID +
  `strict_min_version: "128.0"`, since `optional_host_permissions` — used for the runtime
  Sonar-URL permission grant — was only added in Firefox 128).
- **The bundler itself**: `@crxjs/vite-plugin` (used for the Chrome build via
  `vite.config.ts` / `npm run build:chrome`) generates Chrome-specific MV3 scaffolding
  (a service-worker-loader shim, `web_accessible_resources`) that doesn't translate to
  Firefox. The Firefox build (`scripts/build-firefox.mjs` / `npm run build:firefox`)
  instead produces three fully self-contained IIFE bundles via Vite's plain library-mode
  API — no crxjs, no shared chunks — since neither browser supports declaring content
  scripts or non-`scripts`-array background entries as ES modules in the manifest.

```
npm run build:chrome    # -> dist/           (unchanged from before Firefox support existed)
npm run build:firefox   # -> dist-firefox/
npm run build:all       # both
```

`manifest.json` at the repo root is Chrome's manifest (crxjs reads it directly).
`scripts/build-firefox.mjs` derives Firefox's manifest from it programmatically — same
source of truth for every field both browsers share, diverging only where documented
above — rather than hand-maintaining two manifests that could drift apart.

## Tests

```
npm test
```

Unit tests in `src/core/indeed/extract.test.ts` run the extraction logic against
hand-built HTML fixtures (`fixtures.ts`) modeling both a clean semantic-selector match and
a structural-fallback scenario — including an explicit assertion that left-pane job card
content (titles, companies, snippets from *other* postings) never appears anywhere in the
extracted result. The Tier 1 fixture's structure matches what was confirmed live (see
**Detection strategy** and **Real-world verification**) — still hand-built, not a literal
DOM dump, so expect to need to update it (and the selectors) again when Indeed next
changes something.

## Real-world verification

### 2026-08-20 — Chrome: extraction verified live, extension-loading mechanism not

The core extraction algorithm was run against a real, live `indeed.com` page in a real
Chrome instance (not a fixture): container detection, tiered fallback, field selectors,
and salary parsing all ran against the live DOM. Clicking through 3 different real job
cards produced 3 distinct, correctly-updated extractions, each matching *its own* card's
title and company exactly. One real posting was then pushed through the real ingestion
flow via direct API calls with a real `sonar_pat_` token — `POST /api/ingest` → real
Gemini classification → `POST /api/ingest/confirm` → a real `Application` row, verified
directly in Sonar's database. This surfaced two real bugs, both fixed and covered by
regression tests: the stale `.jobsearch-ViewJobLayout` selector mentioned above, and a
salary-regex ordering bug that truncated "$50 - $100 an hour" down to "$50 - $100 a"
(`(?:a|an|per)` tried the substring "a" before "an" — fixed by reordering to
`(?:an|a|per)`).

**Disclosed gap, confirmed twice, not a claimed pass:** loading `dist/` into Chrome via
the actual extension mechanism (as opposed to running the same logic via direct script
injection) could not be automated. Tried two independent ways — the raw `--load-extension`
command-line flag, and a `chromedriver`-managed session via Selenium — and both were
rejected by this Chrome build; recent Chrome versions disable unpacked-extension loading
via automation by default, and "Load unpacked"'s folder picker is a native OS dialog no
browser-automation tooling can click through (by design). This is a genuine, real
constraint of this Chrome build, not a shortcut taken. It takes a person about 30 seconds
to confirm manually (see **Installing the extension**).

### 2026-08-20 — Firefox: fully verified live, including through the real extension

Unlike Chrome, Firefox's WebDriver implementation (`geckodriver`) has a first-class,
standard command for installing a temporary add-on — the scriptable equivalent of
`about:debugging → Load Temporary Add-on`. This let the *entire* flow run through the
real, loaded extension, not just its extraction logic in isolation:

- Real Firefox (140.14.0esr), extension installed as a temporary add-on via WebDriver.
- Settings saved through the real `options.html` page (not injected via storage APIs).
- Navigated to a live `indeed.com` search page; the content script actually injected the
  widget into the real page.
- Clicked through 3 different real job cards — the widget updated correctly each time,
  matching each card's own title/company exactly (`Senior Software Developer` →
  `Senior Software Developer (Agentic Development)` → `Board Support Package (BSP)
  Development Engineer`, TherapyNotes.com → TherapyNotes.com → Capgemini).
- Clicked the real **Send to Sonar** button in the real widget. It showed "Sending to
  Sonar…", then **"Saved to Sonar ✓"**.
- Verified directly in Sonar's database: a real `Application` row for Capgemini's BSP
  role, correctly classified (industry, seniority, an accurate $73,150–$174,000 pay
  range parsed from the real posting, 11 extracted skills, a real Gemini fit rationale).

**This surfaced one more real, cross-browser-relevant bug**, not Firefox-specific despite
being found there: Sonar's `/api/ingest` and `/api/ingest/confirm` routes had no CORS
headers. The first live attempt failed with a generic network error; the actual cause,
visible in Sonar's server log, was a CORS preflight (`OPTIONS /api/ingest`) getting a bare
`204` with no `Access-Control-Allow-*` headers, so Firefox blocked the real `POST`
client-side before it ever reached the route handler. This means the earlier Chrome
verification's assumption — that host-permission-covered extension fetches bypass CORS
entirely — was never actually verified against a real loaded extension (only against raw
`curl`, which isn't subject to browser CORS enforcement at all). Fixed in Sonar with an
explicit `OPTIONS` handler and `Access-Control-Allow-Origin: *` (safe here specifically
because this route authenticates via an explicit Bearer token, never cookies — see
Sonar's `lib/http/cors.ts`), covered by regression tests, and confirmed fixed by rerunning
the same live Firefox flow end to end.

## Sonar-side setup: API tokens

The extension authenticates to Sonar with a long-lived personal API token — not your
session cookie, which would be fragile (extensions can't easily read `httpOnly` cookies
across origins) and a worse security shape (a leaked session cookie is full account
access; a leaked extension token is scoped to just creating Applications, and is
individually revocable).

1. In Sonar, go to **Settings → API Tokens**.
2. Enter a label (e.g. "Sonar Catch") and click **Generate token**.
3. Copy the token shown — it starts with `sonar_pat_` and is shown exactly once. Sonar
   only ever stores its SHA-256 hash, so if you lose it, generate a new one and revoke the
   old one.
4. You can revoke a token at any time from the same page; a revoked token stops working
   immediately.

## Installing the extension

```
npm install
npm run build:chrome    # -> dist/
npm run build:firefox   # -> dist-firefox/
```

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `dist/` folder.
4. Click the Sonar Catch toolbar icon — this opens the options page.
5. Enter your Sonar instance URL (`http://localhost:3000` during development, or your
   deployed instance's URL) and the API token from the step above, then **Save**.
   You'll be prompted to grant the extension permission to reach that specific URL — the
   extension only ever requests host permissions for the exact Sonar origin you configure,
   not blanket network access.
6. Open a job search on `indeed.com`, click a job in the list, and the **Send to Sonar**
   widget should appear in the bottom-right corner.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `dist-firefox/manifest.json`.
   (Temporary add-ons are removed when Firefox closes — reload after each restart during
   development. For a permanent install, the extension needs to be signed by
   [addons.mozilla.org](https://addons.mozilla.org), even for self-distribution — that's
   a Mozilla requirement independent of this project.)
3. Click the Sonar Catch toolbar icon to open the options page, and configure it the same
   way as Chrome (step 5 above).
4. Same as Chrome from here — open a job search on `indeed.com`, click a job, **Send to
   Sonar** appears.

## Security notes

- The stored API token lives only in `browser.storage.local` — never hardcoded, never
  logged, and readable only by this extension.
- Network requests to Sonar are made from the background script (not the content script),
  so they run with the extension's own granted permissions rather than being subject to
  the host page's CSP.
- Text extracted from Indeed is, by definition, untrusted external content. It feeds into
  the exact same Sonar ingestion pipeline that's already hardened against
  adversarial/prompt-injection input when pasted manually — this extension introduces no
  new trust boundary, it just automates getting text to an existing one.

## Icon

`icons/icon.svg` is the source; `icons/icon{16,32,48,128}.png` are rasterized from it and
referenced by both manifests. The mark is four corner brackets closing on a solid center
dot — a small nod to Sonar's own indigo accent (`#4438DB`) and to what the extension
actually does: isolate one job posting from the page around it. Regenerate the PNGs with
`sharp` (or any SVG rasterizer) if the source ever changes; there's no build-time step for
this, since the icon changes far less often than the code does.

## Non-Indeed career sites

Indeed's detection above is unchanged and stands on its own. Layered on top of it — purely
additively, sharing the same widget and the same send/lookup/duplicate flow — is a small
set of **named, per-company adapters** for other career sites:

| Company | Host | ATS platform |
|---|---|---|
| RBC | `jobs.rbc.com` | Phenom |
| Walmart (US) | `careers.walmart.com` | Phenom (headless / Next.js front end) |
| Best Buy Canada | `bestbuycanada.wd3.myworkdayjobs.com` | Workday |
| CIBC | `cibc.wd3.myworkdayjobs.com` | Workday |
| LinkedIn Jobs | `www.linkedin.com/jobs/*` | LinkedIn's own platform (multi-tenant) |

The first four share a Phenom or Workday extractor, LinkedIn has its own, but each is
registered by name (`src/core/sites/registry.ts`) so a detection problem attributes to a
specific site, not to "something Workday-ish". `host_permissions` /
`content_scripts.matches` name these hosts explicitly — no `<all_urls>`, so the install
prompt stays honest. LinkedIn's is scoped to `/jobs/*` specifically, not all of
linkedin.com, keeping the content script off feed/profile/messaging pages.

Unlike the other four (single-tenant: the site IS the employer), LinkedIn hosts many
different employers, so its adapter has no fixed company label — company comes from the
page itself (JSON-LD `hiringOrganization.name`, or a DOM selector), same as Indeed.

### Detect-and-alert, not silent adapters

The design goal is: try hard on these sites, and **be honest when confidence is low**
rather than either silently guessing wrong or silently doing nothing. Every adapter runs
the same three tiers:

1. **JSON-LD** (`<script type="application/ld+json">` `JobPosting`) — the primary tier.
   It's what the site publishes for Google for Jobs, so it's server-rendered and far more
   stable than internal CSS classes. Verified live to be present on RBC, CIBC, Best Buy
   Canada (2026-08-28), and LinkedIn's guest job page (2026-09-16). → reported as a
   confident **"detected"**.
2. **Platform/site DOM selectors** — Workday `data-automation-id`, Phenom `data-ph-at-id`,
   LinkedIn's own class names. Only present after the SPA renders. Used when JSON-LD is
   missing. → confident **"detected"**.
3. **Generic structural fallback** — largest coherent job-shaped text block on the page.
   Reached only when tiers 1–2 both miss, i.e. the site's structure has drifted since the
   adapter was written. The widget switches to a distinct amber **"Detected via fallback —
   review before sending"** state, and the extracted posting carries
   `detection.confidence: "low"` through the rest of the pipeline. Sending is still
   allowed (Sonar's own confirm step keeps a human in the loop), just clearly flagged.

If all three tiers fail, the widget says **"couldn't detect a job posting here"** and
nothing is sent.

### Adapter health

The content script records the outcome of every run to `browser.storage.local`, and the
options page shows one row per adapter: **Dedicated adapter** (tier 1–2),
**Falling back to generic** (tier 3), **Detection failed**, or **Not seen yet** — so it's
visible at a glance which companies' pages may need re-investigating, rather than finding
out mid-application.

### Verified vs. not

- **RBC, CIBC, Best Buy Canada, Walmart (US)** — manually verified live in-browser
  (2026-09): the widget correctly detects and lets you send a real posting on each site.
  Tier-1 JSON-LD was additionally confirmed by running the actual adapter code against raw
  HTML fetched directly from live job pages.
- **LinkedIn** — tier 1 (JSON-LD) AND, unexpectedly usefully, the guest page's own tier-2
  selectors (`.topcard__org-name-link`, `.top-card-layout__title`,
  `.description__text--rich`) were both confirmed live 2026-09-16 by running the real
  adapter against a real fetched `linkedin.com/jobs/view/<id>/` page — correct title,
  company, location, and description both with and without the JSON-LD present.
  **What's genuinely unverified, and different in kind from the other four:** that guest
  page is a full-page load reachable without logging in. The extension's actual workload is
  mostly LinkedIn's *authenticated* split-view search SPA
  (`linkedin.com/jobs/search/?currentJobId=<id>`, content swapped in place via client-side
  routing — the same shape as Indeed's split view). Fetching that requires a logged-in
  LinkedIn session and executing its client-side JS, neither of which was available here —
  so whether tier 1/2 actually fire on THAT surface (vs. falling to the low-confidence
  generic tier) is unconfirmed. The `job-details-jobs-unified-top-card__*` /
  `jobs-description__content` selectors in `src/core/sites/platforms.ts` are current
  (2026) scraping-guide consensus for that authenticated UI, not independently confirmed.
  LinkedIn also redesigns/A-B-tests this UI on its own schedule (not a shared platform
  convention like Workday's `data-automation-id`), so expect this adapter, more than the
  other four, to need re-verification and possible re-tuning after a real logged-in pass —
  the adapter-health table below is exactly the mechanism for noticing that when it happens.
- Tiers 2–3 (rendered-DOM selectors, structural fallback) beyond what's called out above
  are covered by unit tests against realistic fixtures; confirming them on the live sites
  needs a real browser, the same disclosed constraint as loading the extension into Chrome
  via automation (above).

### Not built: self-healing

The extension does **not** re-derive its own selectors when a site changes (e.g. via an
LLM call). That would trade the honest "this looks low-confidence, review it" signal for a
silent guess. If a dedicated adapter starts falling back, that's a prompt to re-investigate
the site by hand. Automatic self-repair is a possible future direction, not a current
feature.

### Cross-site duplicate detection

If you apply to the same job on two different sites (e.g. it's on both LinkedIn and the
company's own career site), does Sonar Catch tell you? Short answer: **the mechanism
already exists and is site-agnostic** — every send checks `/api/ingest/lookup` first,
regardless of which adapter detected the posting, and shows **"Already logged"** with a
link to the existing entry on a match (see `handleSendPosting` in
`src/adapters/webextension/background.ts`). Nothing about that check is Indeed-specific or
per-adapter; adding LinkedIn as a fifth source didn't require touching it.

What this extension *can't* claim: the actual "is this the same job" decision is fuzzy
matching that happens server-side, in Sonar's own repo, which this project doesn't control
or have visibility into. What was in scope here, and shipped
(`src/core/canonical-company.ts`), is removing one concrete, extension-side source of false
negatives: **the same employer gets named differently depending on where the posting was
found.** Real examples seen live while building this — "Canadian Imperial Bank of Commerce
(Canada)" vs. "CIBC", "050 Best Buy Canada Ltd." vs. "Best Buy Canada", "Royal Bank of
Canada" vs. "RBC". The four direct career-site adapters already avoid this (each has a
fixed, clean company label), but Indeed and LinkedIn both extract whatever text the page
itself uses — so if you saw a CIBC posting on LinkedIn today and the direct CIBC site
tomorrow, the two `company` strings could plausibly not match without help.
`canonicalCompanyName` strips legal suffixes ("Inc.", "Ltd.", "Corp."), regional
parentheticals ("(Canada)"), and Workday's leading numeric tenant codes, then checks a
small alias table, before the company name is used in the duplicate-lookup query — never
before it's sent to Sonar's own ingest/classification pipeline, so what gets stored/shown
is unaffected.

Deliberately **not** attempted: normalizing the job title/role. Trimming words from a title
risks merging two genuinely different postings (e.g. "Software Engineer I" vs. "Software
Engineer II") into one false match, which is worse than missing a real duplicate. That
judgment call belongs in Sonar's own fuzzy-matching logic, not in this extension.

## Scope

Indeed is the core, and its detection is deliberately frozen. The non-Indeed adapters
above are intentionally a short, explicit list rather than a "works on any career site"
promise — each ATS platform has a genuinely different DOM shape, and the honest
detect-and-alert behaviour is only meaningful when it's backed by real per-site
investigation.
