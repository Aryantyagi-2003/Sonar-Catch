import type { PlatformSelectors } from "@/core/sites/platform";

// Tier-2 DOM selectors, per ATS platform. These only ever match in a real browser AFTER the
// SPA renders (verified 2026-08-28: none of these appear in the server HTML). They are the
// *fallback* to JSON-LD, not the primary path — so a platform reskin that breaks them
// degrades to the generic tier and a visible "review before sending", it doesn't break
// detection outright.

/** Workday "Candidate Experience" sites (*.myworkdayjobs.com). `data-automation-id`
 *  attributes have been stable across Workday tenants for years. */
export const WORKDAY_SELECTORS: PlatformSelectors = {
  title: [
    '[data-automation-id="jobPostingHeader"]',
    'h1[data-automation-id="jobPostingHeader"]',
    'h2[data-automation-id="jobPostingHeader"]',
  ],
  description: ['[data-automation-id="jobPostingDescription"]'],
  location: [
    '[data-automation-id="locations"]',
    '[data-automation-id="jobPostingLocation"]',
    '[data-automation-id="location"]',
  ],
};

/** Phenom career sites (Angular). NOTE: verified live 2026-08-28 that RBC's current Phenom
 *  build renders hashed `phw-c-<hash>-*` classes and exposes almost no `data-ph-at-id`
 *  outside the footer — so on RBC this tier is effectively dead and JSON-LD carries
 *  everything. These selectors are kept for older/other Phenom tenants and as a hedge;
 *  they're low-cost to try and the generic tier backs them up. */
export const PHENOM_SELECTORS: PlatformSelectors = {
  title: [
    '[data-ph-at-id="job-title"]',
    '[data-ph-at-id="jobtitle-text"]',
    ".jd-job-title",
    '.job-title[itemprop="title"]',
    "h1.job-title",
  ],
  description: [
    '[data-ph-at-id="job-description"]',
    '[data-ph-at-id="jobdescription-text"]',
    '[itemprop="description"]',
    ".job-description",
    ".jd-info",
  ],
  location: ['[data-ph-at-id="job-location"]', ".job-location", '[itemprop="jobLocation"]'],
};

// LinkedIn Jobs. Genuinely less verifiable than the four platforms above, and said so
// plainly rather than presenting guesses as confirmed:
//   - The only page I could fetch without a LinkedIn login is the guest, full-page-load
//     `linkedin.com/jobs/view/<id>/` route. Verified LIVE 2026-09-16: 200, no auth wall, a
//     complete schema.org JobPosting JSON-LD block (title/description/hiringOrganization/
//     jobLocation all populated) — that's Tier 1 below, and it's solid.
//   - The extension's real workload is mostly the AUTHENTICATED split-view search SPA
//     (`linkedin.com/jobs/search/?currentJobId=<id>`, content swapped in place via
//     client-side routing, same shape as Indeed's split view) — I have no LinkedIn session
//     and can't execute its client-side JS from here, so I could not confirm whether that
//     SPA state re-injects the same JSON-LD, or what its current DOM looks like. The
//     `job-details-jobs-unified-top-card__*` / `jobs-description__content` selectors below
//     are current (2026) scraping-guide consensus for that authenticated UI, NOT
//     independently confirmed live — treat them as more likely to drift than Workday's or
//     Phenom's, since LinkedIn redesigns/A-B-tests this UI on its own schedule, not a
//     platform-wide convention shared across tenants.
//   - The `topcard__*` / `top-card-layout__*` / `description__text--rich` entries WERE
//     confirmed live on the guest page fetched above — kept as a fallback for whichever
//     LinkedIn surface you're actually on.
// If Tier 1 and Tier 2 both miss on the live authenticated SPA, Tier 3 (generic fallback,
// low confidence) is the real backstop here — more so than for any of the other four sites.
export const LINKEDIN_SELECTORS: PlatformSelectors = {
  title: [
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-unified-top-card__job-title",
    "h1.top-card-layout__title", // guest page — confirmed live 2026-09-16
    "h1.t-24",
  ],
  company: [
    ".job-details-jobs-unified-top-card__company-name a",
    ".jobs-unified-top-card__company-name a",
    "a.topcard__org-name-link", // guest page — confirmed live 2026-09-16
  ],
  description: [
    "#job-details",
    ".jobs-description__content .jobs-box__html-content",
    ".jobs-description-content__text",
    ".description__text--rich", // guest page — confirmed live 2026-09-16
  ],
  location: [
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".jobs-unified-top-card__bullet",
    ".main-job-card__location", // guest page — confirmed live 2026-09-16
  ],
};
