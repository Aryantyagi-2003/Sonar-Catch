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

/** The left-hand scrollable list of job cards — content here must NEVER be attributed to
 *  the currently-open posting. */
export const LIST_CONTAINER_SELECTORS = ["#mosaic-provider-jobcards"];

/** Individual cards within the left list. */
export const LIST_CARD_SELECTOR = '[data-testid="slider_item"]';

/** The right-hand detail pane's outer wrapper. */
export const DETAIL_PANE_SELECTORS = [
  ".jobsearch-RightPane",
  ".jobsearch-ViewJobLayout",
  '[data-testid="jobsearch-ViewjobPaneWrapper"]',
  "#viewJobSSRRoot",
];

export const DETAIL_TITLE_SELECTORS = [
  ".jobsearch-JobInfoHeader-title",
  'h1[data-testid="jobsearch-JobInfoHeader-title"]',
  '[data-testid="jobsearch-JobInfoHeader-title"]',
];

export const DETAIL_COMPANY_SELECTORS = [
  '[data-testid="inlineHeader-companyName"]',
  ".jobsearch-CompanyInfoWithoutHeaderImage",
  '[data-company-name="true"]',
];

export const DETAIL_LOCATION_SELECTORS = [
  '[data-testid="inlineHeader-companyLocation"]',
  '[data-testid="job-location"]',
  ".jobsearch-JobInfoHeader-subtitle",
];

/** Salary rarely gets its own stable testid in the detail pane header — this list is
 *  tried first, then extract.ts falls back to a regex scan of the header text. */
export const DETAIL_SALARY_SELECTORS = [
  '[data-testid="jobsearch-JobMetadataHeader-item"]',
  '[data-testid="attribute_snippet_testid"]',
  ".jobsearch-JobMetadataHeader-item",
];

/** The actual description body. #jobDescriptionText is confirmed live in the split view
 *  today; the others are kept as fallbacks in case Indeed reintroduces them. */
export const DETAIL_DESCRIPTION_SELECTORS = [
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
