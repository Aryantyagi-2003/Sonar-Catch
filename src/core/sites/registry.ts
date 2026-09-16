import type { DetectionMethod, ExtractionResult } from "@/core/types";
import { extractViaPlatform } from "@/core/sites/platform";
import { WORKDAY_SELECTORS, PHENOM_SELECTORS, LINKEDIN_SELECTORS } from "@/core/sites/platforms";
import { canonicalLinkedInJobUrl } from "@/core/sites/linkedin-url";

// Named, per-company adapters. Two of them (RBC, Walmart) share the Phenom extractor and
// two (Best Buy Canada, CIBC) share the Workday extractor — but each is registered
// separately so a detection failure attributes to a specific company in the options-page
// health list, not to "something Workday-ish".
//
// Indeed is deliberately NOT here: its tiered selector detection (src/core/indeed/) is
// untouched and dispatched separately by the content script.

export type AtsPlatform = "workday" | "phenom" | "linkedin";

export interface SiteAdapter {
  id: string;
  label: string;
  platform: AtsPlatform;
  /** Hosts this adapter claims, for display on the options page. */
  hosts: readonly string[];
  matches(url: URL): boolean;
  extract(doc: Document, sourceUrl: string): ExtractionResult;
}

function workdayAdapter(id: string, label: string, companyLabel: string, host: string): SiteAdapter {
  return {
    id,
    label,
    platform: "workday",
    hosts: [host],
    matches: (url) => url.hostname === host,
    extract: (doc, sourceUrl) =>
      extractViaPlatform(doc, sourceUrl, {
        adapterId: id,
        adapterLabel: label,
        companyLabel,
        selectors: WORKDAY_SELECTORS,
      }),
  };
}

function phenomAdapter(id: string, label: string, companyLabel: string, host: string): SiteAdapter {
  return {
    id,
    label,
    platform: "phenom",
    hosts: [host],
    matches: (url) => url.hostname === host,
    extract: (doc, sourceUrl) =>
      extractViaPlatform(doc, sourceUrl, {
        adapterId: id,
        adapterLabel: label,
        companyLabel,
        selectors: PHENOM_SELECTORS,
      }),
  };
}

function linkedinAdapter(): SiteAdapter {
  const host = "www.linkedin.com";
  return {
    id: "linkedin",
    label: "LinkedIn",
    platform: "linkedin",
    hosts: [host],
    // Scoped to /jobs/ paths, not all of linkedin.com — matches manifest.json's narrower
    // host permission and keeps the content script off feed/profile/messaging pages.
    matches: (url) => url.hostname === host && url.pathname.startsWith("/jobs/"),
    extract: (doc, sourceUrl) =>
      extractViaPlatform(doc, canonicalLinkedInJobUrl(sourceUrl), {
        adapterId: "linkedin",
        adapterLabel: "LinkedIn",
        // No fixed companyLabel: unlike the four sites below, LinkedIn hosts many
        // different employers — the company has to come from the page itself (JSON-LD or
        // selectors.company), same as Indeed's own approach.
        selectors: LINKEDIN_SELECTORS,
      }),
  };
}

export const ADAPTERS: readonly SiteAdapter[] = [
  phenomAdapter("rbc", "RBC", "RBC", "jobs.rbc.com"),
  // Walmart US career site: a Phenom-backed Next.js/AEM front end (not the classic Phenom
  // Angular one). Manually verified working live 2026-09 (JSON-LD tier).
  phenomAdapter("walmart", "Walmart", "Walmart", "careers.walmart.com"),
  workdayAdapter("bestbuy-ca", "Best Buy Canada", "Best Buy Canada", "bestbuycanada.wd3.myworkdayjobs.com"),
  workdayAdapter("cibc", "CIBC", "CIBC", "cibc.wd3.myworkdayjobs.com"),
  // See platforms.ts's LINKEDIN_SELECTORS comment: Tier 1 (JSON-LD) is confirmed live on
  // LinkedIn's guest job page; Tier 2 (the authenticated split-view SPA's own DOM) is
  // UNVERIFIED — genuinely less certain than the other four adapters, not just unverified
  // in the same routine way Walmart was.
  linkedinAdapter(),
];

export function adapterFor(url: URL): SiteAdapter | null {
  return ADAPTERS.find((adapter) => adapter.matches(url)) ?? null;
}

export type AdapterHealthStatus = "dedicated" | "fallback" | "failed";

/** Maps a detection method to how the options page should describe the adapter's health. */
export function healthStatusForMethod(method: DetectionMethod | null): AdapterHealthStatus {
  if (method === null) return "failed";
  return method === "structural" ? "fallback" : "dedicated";
}

/** Static description of every adapter, for rendering the options page before (or without)
 *  any live health data. */
export const ADAPTER_META: readonly { id: string; label: string; platform: AtsPlatform; hosts: readonly string[] }[] =
  ADAPTERS.map((a) => ({ id: a.id, label: a.label, platform: a.platform, hosts: a.hosts }));
