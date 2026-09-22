// Indeed's markup is not a public API — these are unofficial, observed selectors that
// WILL drift as Indeed ships changes. Every list here is a priority-ordered fallback
// chain, not a single source of truth; see extract.ts for how the chain is walked and
// what happens when every entry in a chain fails (see README's "Resilience" section for
// the full policy).
//
// Verified 2026-08-20 against a real, live Indeed split-view search page (real Chrome,
// real DOM, not a fixture) — https://www.indeed.com/jobs?q=software+engineer&l=remote:
//   - #mosaic-provider-jobcards + [data-testid="slider_item"]: CONFIRMED live (16 cards).
//   - .jobsearch-RightPane: CONFIRMED live as the actual detail-pane wrapper class.
//     .jobsearch-ViewJobLayout, [data-testid="jobsearch-ViewjobPaneWrapper"], and
//     #viewJobSSRRoot — the selectors originally sourced from cross-referencing other
//     tools — did NOT match on the real page today. The structural fallback tier (see
//     extract.ts) caught this correctly and still extracted a fully accurate posting, but
//     .jobsearch-RightPane is now listed first since it's the one actually confirmed live.
//   - [data-testid="inlineHeader-companyName"|"inlineHeader-companyLocation"],
//     .jobsearch-JobInfoHeader-title, #jobDescriptionText: CONFIRMED live, matched real
//     content correctly.
//   - .jobsearch-JobComponent-embeddedBody: did NOT match on the real page (Indeed
//     appears to only use #jobDescriptionText in the split view today) — kept as a
//     fallback entry in case that changes back, but #jobDescriptionText is listed first.
//   - DETAIL_SALARY_SELECTORS: did NOT match anything inside the real detail pane (the
//     "Full-time"-style attribute chips these were meant to target live elsewhere on the
//     page, not inside .jobsearch-RightPane). The correct salary was recovered entirely
//     via extract.ts's regex scan of the pane's own text — kept as a first-try, but do
//     not trust these specific selectors; the regex fallback is what's actually verified
//     working.
// Everything above was cross-referenced, before this verification pass, across multiple
// independently-maintained, currently-live projects that target this same split-view page
// (github.com/SirAndrii/chromeExtensionIneed for embeddedBody/skeleton/skeleton-testid;
// various current Indeed-scraping guides for the list/card/company/location selectors),
// plus class names visible in Indeed's own shipped CSS. Re-verify periodically — a single
// snapshot in time is not a guarantee it still holds tomorrow.
//
// UPDATE 2026-09-22: the 2026-08-20 selectors above went stale. Indeed shipped a new
// react-native-web-based detail pane (telltale signs: `react-native-html-content` class on
// the description, atomic `css-<hash>`/`r-<hash>` utility classes on nearly every element,
// `role="heading"`/`aria-level` instead of real h1–h3 tags for most headings). ALL of the
// `.jobsearch-*` classes above are absent from it — not just the title selector, the whole
// pane was rebuilt. Caught because the title fallback added in 0.1.7/0.1.8 (extract.ts's
// headingTitle) started reporting "Unknown title", or worse, an actual section heading
// ("Job type") as the title.
//
// The new selectors below were NOT independently fetched (Cloudflare blocks headless
// Chrome from this environment) — they're read directly from a real posting's outerHTML
// the user copied out of their own browser's inspector (a Rexel "Web Project Coordinator"
// listing) and pasted in full. Confirmed present in that real DOM:
//   - `[data-testid="viewjob-main-content"]`: the detail pane's outer wrapper.
//   - `[data-testid="vj-job-title"]`: the title, an `<h5 role="heading">`, not an h1 — this
//     is why the h1/h2/h3-based heading fallback couldn't find it at all. A second, same-text
//     `[data-testid="vj-job-title-compact"]` also exists (a sticky compact header shown on
//     scroll) — kept as a fallback entry, same text either way.
//   - Company has no dedicated testid; `[data-testid="company-info-metadata"] a` is the
//     first link in that block, and its text (not its `aria-label`, which carries a
//     "(opens in a new tab)" suffix) is the company name.
//   - `.react-native-html-content` / `.simple-job-description-html`: the description body's
//     own class names (semantic, not an atomic utility class) — listed first since they're
//     more likely to survive a future style refactor than a hash-based class would.
//   - Location and salary have NO stable testid or class in this new markup at all (they're
//     plain, unmarked text nodes) — not guessed here; left to the existing structural/regex
//     fallbacks rather than inventing a positional selector likely to mismatch.
// Old `.jobsearch-*` selectors are kept, not removed — Indeed appears to run more than one
// front end concurrently (locale/experiment-dependent), so either generation may still be
// live somewhere; the new testid-based ones are simply tried first.

/** The left-hand scrollable list of job cards — content here must NEVER be attributed to
 *  the currently-open posting. */
export const LIST_CONTAINER_SELECTORS = ["#mosaic-provider-jobcards"];

/** Individual cards within the left list. */
export const LIST_CARD_SELECTOR = '[data-testid="slider_item"]';

/** The right-hand detail pane's outer wrapper. */
export const DETAIL_PANE_SELECTORS = [
  '[data-testid="viewjob-main-content"]', // new react-native-web layout, confirmed 2026-09-22
  ".jobsearch-RightPane",
  ".jobsearch-ViewJobLayout",
  '[data-testid="jobsearch-ViewjobPaneWrapper"]',
  "#viewJobSSRRoot",
];

export const DETAIL_TITLE_SELECTORS = [
  '[data-testid="vj-job-title"]', // new layout, confirmed 2026-09-22 — an h5, not an h1
  '[data-testid="vj-job-title-compact"]', // same text, the sticky compact header's copy
  ".jobsearch-JobInfoHeader-title",
  'h1[data-testid="jobsearch-JobInfoHeader-title"]',
  '[data-testid="jobsearch-JobInfoHeader-title"]',
];

export const DETAIL_COMPANY_SELECTORS = [
  // New layout, confirmed 2026-09-22: no dedicated company testid, but this is reliably
  // the company's own link (its aria-label carries a "(opens in a new tab)" suffix that
  // textOf's use of .textContent — the visible link text — never picks up).
  '[data-testid="company-info-metadata"] a',
  '[data-testid="desktop-embedded-compact-header"] a',
  '[data-testid="inlineHeader-companyName"]',
  ".jobsearch-CompanyInfoWithoutHeaderImage",
  '[data-company-name="true"]',
];

export const DETAIL_LOCATION_SELECTORS = [
  '[data-testid="inlineHeader-companyLocation"]',
  '[data-testid="job-location"]',
  ".jobsearch-JobInfoHeader-subtitle",
  // New layout (confirmed 2026-09-22) has no testid/class for location at all — nothing
  // added here; it falls through to the structural/regex fallbacks rather than a guessed
  // positional selector.
];

/** Salary rarely gets its own stable testid in the detail pane header — this list is
 *  tried first, then extract.ts falls back to a regex scan of the header text. */
export const DETAIL_SALARY_SELECTORS = [
  '[data-testid="jobsearch-JobMetadataHeader-item"]',
  '[data-testid="attribute_snippet_testid"]',
  ".jobsearch-JobMetadataHeader-item",
  // New layout (confirmed 2026-09-22): also no testid for the salary text itself — same
  // reasoning as location above; the regex fallback over the pane's full text still finds
  // it (both the compact header's "$X–$Y a year" and the description's own salary line).
];

/** The actual description body. #jobDescriptionText is confirmed live in the split view
 *  today; the others are kept as fallbacks in case Indeed reintroduces them. */
export const DETAIL_DESCRIPTION_SELECTORS = [
  // New react-native-web layout, confirmed 2026-09-22 — Indeed's own semantic class names
  // for this block (not an atomic utility class), listed first since they're more likely
  // to survive a future style refactor than a hash-based class would.
  ".react-native-html-content",
  ".simple-job-description-html",
  "#jobDescriptionText",
  ".jobsearch-JobComponent-embeddedBody",
  ".jobsearch-JobComponent-description",
];

/** Shown while the right pane is re-rendering after a card click; removal of this element
 *  is the strongest available signal that new content has finished loading. */
export const SKELETON_CLASS = "jobsearch-ViewJobSkeleton";
export const SKELETON_TEST_ID = "viewJob-skeleton";

/** Below this many characters of extracted description text, treat the result as noise
 *  rather than a real posting (e.g. a container matched but was still mid-render). */
export const MIN_DESCRIPTION_LENGTH = 100;
