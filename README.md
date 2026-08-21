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

1. A content script runs only on `indeed.com` job search pages.
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

## Scope

Indeed only, deliberately. Each job board has a genuinely different DOM shape, and a
"generic extraction" layer across all of them would be a much bigger, mushier problem than
this. A working Indeed-only extension beats a half-working universal one.
