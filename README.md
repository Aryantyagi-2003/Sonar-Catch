# Sonar Catch

A browser extension companion to [Sonar](https://github.com/Aryantyagi-2003/Sonar) (a
personal job-search tracker). While browsing Indeed's search results, Sonar Catch detects
the specific job posting currently open in the right-hand detail pane, extracts just that
listing's text, and sends it to Sonar's ingestion API for Gemini-backed classification.

It does not scrape, apply, or automate anything beyond that one action, and it never
touches the left-hand results list.

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
implementation details that change without notice, and there was no way to verify them
against a live, authenticated Indeed session while building this (Indeed's bot protection
blocks unauthenticated automated fetches). The selectors in
[`src/core/indeed/selectors.ts`](src/core/indeed/selectors.ts) were cross-referenced
across multiple independently-maintained, currently-live tools that target this same
split-view page, plus class names visible in Indeed's own shipped CSS — but that is *best
available approximation*, not a guarantee.

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
- **`src/adapters/chrome/`** — everything that touches `chrome.*` APIs or the DOM as a
  live document: the content script (MutationObserver wiring, the injected widget),
  the background service worker (does the actual network calls, so they run with the
  extension's granted host permissions rather than the page's), `chrome.storage.local`
  access, and the options page.

## Tests

```
npm test
```

Unit tests in `src/core/indeed/extract.test.ts` run the extraction logic against
hand-built HTML fixtures (`fixtures.ts`) modeling both a clean semantic-selector match and
a structural-fallback scenario — including an explicit assertion that left-pane job card
content (titles, companies, snippets from *other* postings) never appears anywhere in the
extracted result. These fixtures are constructed from the selector research above, not
scraped from a live page (see **Detection strategy**) — treat them as "the shape we
believe the DOM has," and expect to need to update them (and the selectors) when Indeed
changes something.

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
npm run build
```

This produces an unpacked extension in `dist/`.

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

## Security notes

- The stored API token lives only in `chrome.storage.local` — never hardcoded, never
  logged, and readable only by this extension.
- Network requests to Sonar are made from the background service worker (not the content
  script), so they run with the extension's own granted permissions rather than being
  subject to the host page's CSP.
- Text extracted from Indeed is, by definition, untrusted external content. It feeds into
  the exact same Sonar ingestion pipeline that's already hardened against
  adversarial/prompt-injection input when pasted manually — this extension introduces no
  new trust boundary, it just automates getting text to an existing one.

## Scope

Indeed only, deliberately. Each job board has a genuinely different DOM shape, and a
"generic extraction" layer across all of them would be a much bigger, mushier problem than
this. A working Indeed-only extension beats a half-working universal one.
