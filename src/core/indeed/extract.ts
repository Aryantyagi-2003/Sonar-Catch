import type { ExtractedJobPosting, ExtractedPayRange, ExtractionResult } from "@/core/types";
import {
  LIST_CONTAINER_SELECTORS,
  DETAIL_PANE_SELECTORS,
  DETAIL_TITLE_SELECTORS,
  DETAIL_COMPANY_SELECTORS,
  DETAIL_LOCATION_SELECTORS,
  DETAIL_SALARY_SELECTORS,
  DETAIL_DESCRIPTION_SELECTORS,
  SKELETON_CLASS,
  SKELETON_TEST_ID,
  MIN_DESCRIPTION_LENGTH,
} from "@/core/indeed/selectors";

function queryFirst(root: ParentNode, selectors: readonly string[]): Element | null {
  for (const selector of selectors) {
    const match = root.querySelector(selector);
    if (match) return match;
  }
  return null;
}

function textOf(el: Element | null): string | null {
  if (!el) return null;
  const text = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return text.length > 0 ? text : null;
}

function isSkeletonPresent(container: Element): boolean {
  if (container.getElementsByClassName(SKELETON_CLASS).length > 0) return true;
  return container.querySelector(`[data-testid="${SKELETON_TEST_ID}"]`) !== null;
}

/** Tier 1 (semantic) then Tier 2 (structural) search for the detail-pane container.
 *  Tier 2 never considers anything inside the left-hand list container, so a stale
 *  Tier 1 selector can't silently degrade into leaking list content. */
function findDetailPaneContainer(doc: Document): { el: Element; tier: "selector" | "structural" } | null {
  const bySelector = queryFirst(doc, DETAIL_PANE_SELECTORS);
  if (bySelector) return { el: bySelector, tier: "selector" };

  const listContainer = queryFirst(doc, LIST_CONTAINER_SELECTORS);

  const candidates = Array.from(doc.body.querySelectorAll<HTMLElement>("div, section, main"));
  let best: HTMLElement | null = null;
  let bestLength = 0;

  for (const candidate of candidates) {
    if (listContainer && (listContainer === candidate || listContainer.contains(candidate))) continue;
    if (candidate.contains(listContainer)) continue; // an ancestor wrapping both panes isn't "the" detail pane
    if (candidate.querySelector(LIST_CONTAINER_SELECTORS.join(","))) continue; // still wraps the list somewhere inside

    const length = candidate.textContent?.trim().length ?? 0;
    if (length > bestLength) {
      best = candidate;
      bestLength = length;
    }
  }

  if (best && bestLength >= MIN_DESCRIPTION_LENGTH) {
    return { el: best, tier: "structural" };
  }
  return null;
}

function extractSalary(container: Element): ExtractedPayRange | null {
  const bySelector = textOf(queryFirst(container, DETAIL_SALARY_SELECTORS));
  const headerText = container.textContent ?? "";

  const raw = bySelector ?? matchSalaryText(headerText);
  if (!raw) return null;

  const amounts = raw.match(/\$[\d,]+(?:\.\d+)?/g)?.map((s) => Number(s.replace(/[$,]/g, ""))) ?? [];
  return {
    min: amounts[0] ?? null,
    max: amounts.length > 1 ? (amounts[1] ?? null) : (amounts[0] ?? null),
    raw,
  };
}

function matchSalaryText(text: string): string | null {
  const match = text.match(/\$[\d,]+(?:\.\d+)?(?:\s*(?:-|to|–)\s*\$?[\d,]+(?:\.\d+)?)?\s*(?:a|an|per)?\s*(?:year|hour|month|week|day)?/i);
  return match ? match[0].trim() : null;
}

export function extractIndeedJobPosting(doc: Document, sourceUrl: string): ExtractionResult {
  const container = findDetailPaneContainer(doc);
  if (!container) return { status: "not-found" };

  if (isSkeletonPresent(container.el)) return { status: "loading" };

  const title = textOf(queryFirst(container.el, DETAIL_TITLE_SELECTORS));
  const company = textOf(queryFirst(container.el, DETAIL_COMPANY_SELECTORS));
  const location = textOf(queryFirst(container.el, DETAIL_LOCATION_SELECTORS));
  // Falls back to the whole container's text when no description-specific selector
  // matches — this is the final fallback tier, since a structurally-located container has
  // no known sub-selector to try in the first place.
  const descriptionText = textOf(queryFirst(container.el, DETAIL_DESCRIPTION_SELECTORS)) ?? textOf(container.el);

  if (!descriptionText || descriptionText.length < MIN_DESCRIPTION_LENGTH) {
    return { status: "not-found" };
  }

  // A structural-tier match has no title/company selectors to rely on — fall back to the
  // container's own text for a best-effort title/company rather than reporting "not
  // found" outright when the description itself is clearly present and substantial.
  const posting: ExtractedJobPosting = {
    title: title ?? "Unknown title",
    company: company ?? "Unknown company",
    location,
    salary: extractSalary(container.el),
    descriptionText,
    sourceUrl,
    containerTier: container.tier,
  };

  return { status: "ok", posting };
}
