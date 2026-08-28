import type { ExtractedJobPosting } from "@/core/types";
import { parseSalaryText } from "@/core/sites/salary";

// The last-resort tier, shared by every non-Indeed adapter. Reached only when a site's
// JSON-LD is absent AND its platform-specific selectors miss — i.e. the adapter's
// assumptions about this site have gone stale. It finds "the largest coherent job-shaped
// block of text on the page" and is ALWAYS reported as low-confidence so the widget can
// tell the user to review before sending.

/** Generic fallback needs a higher bar than a selector hit — there's no structural anchor
 *  proving this text is the posting, so demand more of it before trusting it at all. */
export const GENERIC_MIN_LENGTH = 600;

const BLOCK_SELECTOR = "main, article, section, div";
// Text this short inside a "big" block is chrome (nav, cookie bar, footer), not a posting.
const COHERENT_CHILD_RATIO = 0.85;

function visibleTextLength(el: Element): number {
  return el.textContent?.replace(/\s+/g, " ").trim().length ?? 0;
}

/** Walk down from a container into the tightest descendant that still holds essentially all
 *  of its text — stops us reporting <body> or a layout wrapper as "the posting". */
function tightenToContentRoot(start: Element): Element {
  let current = start;
  const startLen = visibleTextLength(current);
  if (startLen === 0) return current;

  for (;;) {
    const children = Array.from(current.children);
    const dominant = children.find(
      (child) => visibleTextLength(child) >= startLen * COHERENT_CHILD_RATIO,
    );
    if (!dominant) return current;
    current = dominant;
  }
}

function guessTitle(doc: Document, container: Element): string {
  const heading = container.querySelector("h1") ?? doc.querySelector("h1");
  const headingText = heading?.textContent?.replace(/\s+/g, " ").trim();
  if (headingText) return headingText;

  const docTitle = doc.title?.split(/[|–—–—-]/)[0]?.trim();
  return docTitle && docTitle.length > 0 ? docTitle : "Unknown title";
}

export function extractGeneric(
  doc: Document,
  sourceUrl: string,
  ctx: { adapterId: string; adapterLabel: string; companyLabel?: string },
): { posting: ExtractedJobPosting } | null {
  const body = doc.body;
  if (!body) return null;

  let best: Element | null = null;
  let bestLen = 0;
  for (const candidate of Array.from(body.querySelectorAll(BLOCK_SELECTOR))) {
    const len = visibleTextLength(candidate);
    if (len > bestLen) {
      best = candidate;
      bestLen = len;
    }
  }

  if (!best || bestLen < GENERIC_MIN_LENGTH) return null;

  const container = tightenToContentRoot(best);
  const descriptionText = container.textContent?.replace(/\s+/g, " ").trim() ?? "";
  if (descriptionText.length < GENERIC_MIN_LENGTH) return null;

  return {
    posting: {
      title: guessTitle(doc, container),
      company: ctx.companyLabel ?? "Unknown company",
      location: null,
      salary: parseSalaryText(descriptionText),
      descriptionText,
      sourceUrl,
      detection: {
        adapterId: ctx.adapterId,
        adapterLabel: ctx.adapterLabel,
        method: "structural",
        confidence: "low",
      },
    },
  };
}
