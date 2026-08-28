import type { ExtractedPayRange } from "@/core/types";

// A standalone copy of Indeed's salary-text heuristic (src/core/indeed/extract.ts). Kept
// separate on purpose: the Indeed path is frozen and must not gain a shared dependency on
// this new code. Same "an" before "a" ordering bug fix carried over.
const SALARY_RE =
  /\$[\d,]+(?:\.\d+)?(?:\s*(?:-|to|–|—)\s*\$?[\d,]+(?:\.\d+)?)?\s*(?:an|a|per)?\s*(?:year|yr|hour|hr|month|mo|week|wk|day|annually|hourly)?/i;

export function parseSalaryText(text: string | null | undefined): ExtractedPayRange | null {
  if (!text) return null;
  const match = text.match(SALARY_RE);
  if (!match) return null;
  const raw = match[0].trim();

  const amounts = raw.match(/\$[\d,]+(?:\.\d+)?/g)?.map((s) => Number(s.replace(/[$,]/g, ""))) ?? [];
  if (amounts.length === 0) return null;

  return {
    min: amounts[0] ?? null,
    max: amounts.length > 1 ? (amounts[1] ?? null) : (amounts[0] ?? null),
    raw,
  };
}

/** schema.org JobPosting `baseSalary` -> our pay range, when the site provides it
 *  structurally (cleaner than regex-scraping the description). */
export function parseJsonLdBaseSalary(baseSalary: unknown): ExtractedPayRange | null {
  if (!baseSalary || typeof baseSalary !== "object") return null;
  const value = (baseSalary as Record<string, unknown>).value;
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;

  const num = (x: unknown): number | null => {
    const n = typeof x === "string" ? Number(x.replace(/[$,]/g, "")) : typeof x === "number" ? x : NaN;
    return Number.isFinite(n) ? n : null;
  };

  const min = num(v.minValue) ?? num(v.value);
  const max = num(v.maxValue) ?? num(v.value);
  if (min === null && max === null) return null;

  const unit = typeof v.unitText === "string" ? ` per ${v.unitText.toLowerCase()}` : "";
  const currency =
    typeof (baseSalary as Record<string, unknown>).currency === "string"
      ? `${(baseSalary as Record<string, unknown>).currency} `
      : "";
  const raw =
    min !== null && max !== null && min !== max
      ? `${currency}${min}–${max}${unit}`.trim()
      : `${currency}${min ?? max}${unit}`.trim();

  return { min: min ?? max, max: max ?? min, raw };
}
