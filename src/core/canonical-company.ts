// Improves cross-site duplicate detection without touching Sonar's own matching logic
// (a separate repo/service this project doesn't control). background.ts's lookup call
// already works across ANY site — it's one /api/ingest/lookup request regardless of which
// adapter detected the posting — but its accuracy depends on the "company" string it's
// given being consistent. That string can come from very different places depending on
// where the posting was found:
//   - Indeed / LinkedIn: whatever text the page itself uses, which varies by how the
//     employer set up their listing/company page (e.g. "Royal Bank of Canada",
//     "Canadian Imperial Bank of Commerce (Canada)").
//   - The four direct career-site adapters: a fixed clean label ("RBC", "CIBC") — but only
//     because those are single-tenant sites; that fix doesn't reach Indeed or LinkedIn.
// This does NOT touch title/role matching — deliberately. Stripping words from a job title
// risks merging two genuinely different postings (e.g. "Software Engineer I" vs
// "Software Engineer II"), which is worse than a missed duplicate. That fuzzy-matching
// judgment call belongs to Sonar's backend, not this extension.

const LEGAL_SUFFIX_RE =
  /[,]?\s*\b(incorporated|inc\.?|limited|ltd\.?|llc|corp\.?|corporation|co\.?|company|plc)\s*$/i;
const TRAILING_PARENTHETICAL_RE = /\s*\([^)]*\)\s*$/;
const LEADING_TENANT_CODE_RE = /^\d{2,}\s+/; // e.g. Workday's "050 Best Buy Canada Ltd."

const ALIASES: Record<string, string> = {
  "royal bank of canada": "RBC",
  rbc: "RBC",
  "canadian imperial bank of commerce": "CIBC",
  "cibc bank usa": "CIBC",
  cibc: "CIBC",
  "best buy canada": "Best Buy Canada",
  "best buy": "Best Buy",
  walmart: "Walmart",
};

/** Normalizes a company name for duplicate-lookup purposes only — never used for the text
 *  actually sent to Sonar's ingest/classification pipeline (see file header). Idempotent:
 *  running it twice, or on an already-clean name, is a no-op. */
export function canonicalCompanyName(raw: string): string {
  let s = raw.trim();
  if (s.length === 0) return s;
  // Our own "not found" sentinel (extract.ts's fallback when nothing named a company) ends
  // in the word "company" — must not be run through LEGAL_SUFFIX_RE like a real name, or it
  // silently mutates into the more confusing "Unknown" rather than staying an obvious
  // placeholder.
  if (s.toLowerCase() === "unknown company") return s;

  s = s.replace(LEADING_TENANT_CODE_RE, "");
  s = s.replace(TRAILING_PARENTHETICAL_RE, "").trim();
  s = s.replace(LEGAL_SUFFIX_RE, "").trim();

  return ALIASES[s.toLowerCase()] ?? s;
}
