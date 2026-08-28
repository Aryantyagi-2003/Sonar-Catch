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
