export interface ExtractedPayRange {
  min: number | null;
  max: number | null;
  raw: string;
}

export interface ExtractedJobPosting {
  title: string;
  company: string;
  location: string | null;
  salary: ExtractedPayRange | null;
  descriptionText: string;
  sourceUrl: string;
  /** How the detail-pane container itself was located — surfaced in the UI/logs so a
   *  structural-fallback extraction (more likely to be wrong) never looks identical to a
   *  clean selector match. */
  containerTier: "selector" | "structural";
}

export type ExtractionResult =
  | { status: "ok"; posting: ExtractedJobPosting }
  | { status: "not-found" }
  | { status: "loading" };
