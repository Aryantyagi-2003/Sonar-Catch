// Indeed's markup is not a public API — these are unofficial, observed selectors that
// WILL drift as Indeed ships changes. Every list here is a priority-ordered fallback
// chain, not a single source of truth; see extract.ts for how the chain is walked and
// what happens when every entry in a chain fails (see README's "Resilience" section for
// the full policy).
//
// Sourced from cross-referencing multiple independently-maintained, currently-live
// projects that target Indeed's split-view search page (not just Indeed's standalone job
// page), plus class names visible in Indeed's own shipped CSS:
//   - jobsearch-JobComponent-embeddedBody / jobsearch-ViewJobSkeleton / viewJob-skeleton:
//     github.com/SirAndrii/chromeExtensionIneed (a maintained extension doing exactly
//     this kind of split-pane targeting today)
//   - #mosaic-provider-jobcards, [data-testid="slider_item"|"company-name"|"text-location"]:
//     documented across multiple current Indeed-scraping guides/tools
//   - jobsearch-ViewJobLayout: present in Indeed's own production stylesheet
//   - jobsearch-JobInfoHeader-title / jobsearch-CompanyInfoWithoutHeaderImage: documented
//     across multiple current Indeed-scraping tools
// No live authenticated browser session was available to verify these directly against
// Indeed's current DOM at build time (Indeed's bot protection blocks unauthenticated
// automated fetches) — this is the best available approximation, not a guarantee.

/** The left-hand scrollable list of job cards — content here must NEVER be attributed to
 *  the currently-open posting. */
export const LIST_CONTAINER_SELECTORS = ["#mosaic-provider-jobcards"];

/** Individual cards within the left list. */
export const LIST_CARD_SELECTOR = '[data-testid="slider_item"]';

/** The right-hand detail pane's outer wrapper. */
export const DETAIL_PANE_SELECTORS = [
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

/** The actual description body, split-view specific first, standalone-page id as a
 *  fallback (Indeed reuses this id on the non-split /viewjob page). */
export const DETAIL_DESCRIPTION_SELECTORS = [
  ".jobsearch-JobComponent-embeddedBody",
  "#jobDescriptionText",
  ".jobsearch-JobComponent-description",
];

/** Shown while the right pane is re-rendering after a card click; removal of this element
 *  is the strongest available signal that new content has finished loading. */
export const SKELETON_CLASS = "jobsearch-ViewJobSkeleton";
export const SKELETON_TEST_ID = "viewJob-skeleton";

/** Below this many characters of extracted description text, treat the result as noise
 *  rather than a real posting (e.g. a container matched but was still mid-render). */
export const MIN_DESCRIPTION_LENGTH = 100;
