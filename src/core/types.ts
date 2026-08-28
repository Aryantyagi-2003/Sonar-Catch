export interface ExtractedPayRange {
  min: number | null;
  max: number | null;
  raw: string;
}

/** How a non-Indeed site adapter located the posting, in decreasing order of trust:
 *  - "json-ld"    — a `<script type="application/ld+json">` JobPosting block (most durable;
 *                   it's what the site publishes for Google for Jobs, not an internal detail).
 *  - "selector"   — a platform-specific DOM selector (Workday `data-automation-id`,
 *                   Phenom `data-ph-at-id`) — only present after the SPA renders.
 *  - "structural" — neither of the above matched, so a generic "largest job-shaped text
 *                   block" heuristic was used. This is the low-confidence tier. */
export type DetectionMethod = "json-ld" | "selector" | "structural";
export type DetectionConfidence = "high" | "low";

/** Attached by non-Indeed site adapters so a fallback extraction never looks identical to a
 *  confident one — drives the widget's "review before sending" state and the options-page
 *  adapter-health list. Indeed's own path does not set this (it uses `containerTier`). */
export interface SiteDetection {
  adapterId: string;
  adapterLabel: string;
  method: DetectionMethod;
  confidence: DetectionConfidence;
}

export interface ExtractedJobPosting {
  title: string;
  company: string;
  location: string | null;
  salary: ExtractedPayRange | null;
  descriptionText: string;
  sourceUrl: string;
  /** Indeed only: how the detail-pane container itself was located — surfaced in the
   *  UI/logs so a structural-fallback extraction (more likely to be wrong) never looks
   *  identical to a clean selector match. Non-Indeed adapters set `detection` instead. */
  containerTier?: "selector" | "structural";
  /** Set by non-Indeed site adapters (see `src/core/sites/`). */
  detection?: SiteDetection;
}

export type ExtractionResult =
  | { status: "ok"; posting: ExtractedJobPosting }
  | { status: "not-found" }
  | { status: "loading" };
