import type { DetectionMethod, ExtractionResult } from "@/core/types";
import { extractViaPlatform } from "@/core/sites/platform";
import { WORKDAY_SELECTORS, PHENOM_SELECTORS } from "@/core/sites/platforms";

// Named, per-company adapters. Two of them (RBC, Walmart) share the Phenom extractor and
// two (Best Buy Canada, CIBC) share the Workday extractor — but each is registered
// separately so a detection failure attributes to a specific company in the options-page
// health list, not to "something Workday-ish".
//
// Indeed is deliberately NOT here: its tiered selector detection (src/core/indeed/) is
// untouched and dispatched separately by the content script.

export type AtsPlatform = "workday" | "phenom";

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

export const ADAPTERS: readonly SiteAdapter[] = [
  phenomAdapter("rbc", "RBC", "RBC", "jobs.rbc.com"),
  // Walmart US career site. Verified 2026-08-28 that it's a Next.js/AEM front end (not the
  // classic Phenom Angular one), but it's a Phenom-backed "headless" site and is expected
  // to still publish JobPosting JSON-LD — its Tier-1 path is what should carry it. Its
  // Tier-2 (Phenom DOM) selectors are UNVERIFIED against this front end; the generic tier
  // is the real backstop until a live check confirms otherwise.
  phenomAdapter("walmart", "Walmart", "Walmart", "careers.walmart.com"),
  workdayAdapter("bestbuy-ca", "Best Buy Canada", "Best Buy Canada", "bestbuycanada.wd3.myworkdayjobs.com"),
  workdayAdapter("cibc", "CIBC", "CIBC", "cibc.wd3.myworkdayjobs.com"),
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
