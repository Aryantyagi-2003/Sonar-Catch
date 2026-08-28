import type { ExtractedJobPosting, ExtractionResult } from "@/core/types";
import { findJobPostingJsonLd } from "@/core/sites/jsonld";
import { extractGeneric } from "@/core/sites/generic";
import { parseSalaryText } from "@/core/sites/salary";

// Shared 3-tier extraction used by every named non-Indeed adapter. The adapters
// (registry.ts) supply only what differs per platform: a clean company label and the
// platform's DOM selector chains.
//
//   Tier 1  JSON-LD JobPosting          -> confidence "high", method "json-ld"
//   Tier 2  platform DOM selectors      -> confidence "high", method "selector"
//   Tier 3  generic structural fallback -> confidence "low",  method "structural"
//   (none)  -> { status: "not-found" } — the widget says so; nothing is sent.

/** Minimum plausible description length for the two high-confidence tiers. Matches Indeed's
 *  MIN_DESCRIPTION_LENGTH. The generic tier uses its own, higher bar. */
export const MIN_DESCRIPTION_LENGTH = 100;

export interface PlatformSelectors {
  title: readonly string[];
  description: readonly string[];
  location: readonly string[];
}

export interface AdapterContext {
  adapterId: string;
  adapterLabel: string;
  /** Career sites we target are single-tenant, so the posting DOM rarely names the company
   *  cleanly (or names it as "050 Best Buy Canada Ltd."). This label wins over whatever the
   *  page says. */
  companyLabel: string;
  selectors: PlatformSelectors;
}

function textOf(el: Element | null): string | null {
  if (!el) return null;
  const text = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return text.length > 0 ? text : null;
}

function queryFirst(root: ParentNode, selectors: readonly string[]): Element | null {
  for (const selector of selectors) {
    try {
      const match = root.querySelector(selector);
      if (match) return match;
    } catch {
      // Ignore malformed selector strings rather than aborting the whole chain.
    }
  }
  return null;
}

export function extractViaPlatform(doc: Document, sourceUrl: string, ctx: AdapterContext): ExtractionResult {
  // --- Tier 1: JSON-LD ---
  const ld = findJobPostingJsonLd(doc);
  if (ld && ld.descriptionText.length >= MIN_DESCRIPTION_LENGTH) {
    const posting: ExtractedJobPosting = {
      title: ld.title ?? "Unknown title",
      company: ctx.companyLabel || ld.company || "Unknown company",
      location: ld.location,
      salary: ld.salary ?? parseSalaryText(ld.descriptionText),
      descriptionText: ld.descriptionText,
      sourceUrl,
      detection: {
        adapterId: ctx.adapterId,
        adapterLabel: ctx.adapterLabel,
        method: "json-ld",
        confidence: "high",
      },
    };
    return { status: "ok", posting };
  }

  // --- Tier 2: platform-specific DOM selectors ---
  const descriptionEl = queryFirst(doc, ctx.selectors.description);
  const descriptionText = textOf(descriptionEl);
  if (descriptionText && descriptionText.length >= MIN_DESCRIPTION_LENGTH) {
    const title = textOf(queryFirst(doc, ctx.selectors.title));
    const location = textOf(queryFirst(doc, ctx.selectors.location));
    const posting: ExtractedJobPosting = {
      title: title ?? ld?.title ?? "Unknown title",
      company: ctx.companyLabel || "Unknown company",
      location: location ?? ld?.location ?? null,
      salary: parseSalaryText(descriptionText),
      descriptionText,
      sourceUrl,
      detection: {
        adapterId: ctx.adapterId,
        adapterLabel: ctx.adapterLabel,
        method: "selector",
        confidence: "high",
      },
    };
    return { status: "ok", posting };
  }

  // --- Tier 3: generic structural fallback (low confidence) ---
  const generic = extractGeneric(doc, sourceUrl, {
    adapterId: ctx.adapterId,
    adapterLabel: ctx.adapterLabel,
    companyLabel: ctx.companyLabel,
  });
  if (generic) return { status: "ok", posting: generic.posting };

  return { status: "not-found" };
}
