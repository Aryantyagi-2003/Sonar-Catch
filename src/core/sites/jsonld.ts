import type { ExtractedPayRange } from "@/core/types";
import { jsonLdDescriptionToText } from "@/core/sites/html-text";
import { parseJsonLdBaseSalary } from "@/core/sites/salary";

// Reads a schema.org JobPosting out of a page's <script type="application/ld+json"> blocks.
//
// This is the primary, most-durable detection tier for every non-Indeed site we support:
// it's the representation the career site publishes for Google for Jobs, so it's both
// server-rendered (present before the SPA boots) and far less volatile than internal CSS
// classes. Verified live 2026-08-28: all three of Best Buy Canada, CIBC (Workday) and RBC
// (Phenom) emit a standard root `"@type": "JobPosting"` block in the server HTML.
//
// Real-world shape details this handles:
//   - Workday serializes "@context"/"@type" as the LAST keys of the object (not the
//     first) — a non-issue for JSON.parse, but it's why a naive "first 2KB" eyeball of
//     the block can look like @type is missing. It isn't.
//   - `looksLikeJobPosting` still accepts "has description + hiringOrganization.name"
//     without @type, as a hedge for other tenants — not load-bearing for these four.
//   - A page can carry several ld+json blocks (RBC also ships a WebPage one); we scan all
//     and take the first that's a JobPosting.
//   - Phenom's "description" is double-escaped HTML; jsonLdDescriptionToText untangles it.
//   - blocks can be a single object, an array, or a { "@graph": [...] } wrapper.

export interface JsonLdJobPosting {
  title: string | null;
  descriptionText: string;
  company: string | null;
  location: string | null;
  salary: ExtractedPayRange | null;
}

function typeMatches(node: Record<string, unknown>): boolean {
  const t = node["@type"];
  if (typeof t === "string") return t.toLowerCase() === "jobposting";
  if (Array.isArray(t)) return t.some((x) => typeof x === "string" && x.toLowerCase() === "jobposting");
  return false;
}

function looksLikeJobPosting(node: Record<string, unknown>): boolean {
  if (typeMatches(node)) return true;
  const hasDescription = typeof node.description === "string" && node.description.length > 0;
  const org = node.hiringOrganization;
  const hasOrg =
    typeof org === "object" && org !== null && typeof (org as Record<string, unknown>).name === "string";
  return hasDescription && hasOrg;
}

function collectNodes(parsed: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(parsed)) {
    for (const item of parsed) collectNodes(item, out);
    return;
  }
  if (!parsed || typeof parsed !== "object") return;
  const node = parsed as Record<string, unknown>;
  if (Array.isArray(node["@graph"])) {
    for (const item of node["@graph"] as unknown[]) collectNodes(item, out);
  }
  out.push(node);
}

function orgName(node: Record<string, unknown>): string | null {
  const org = node.hiringOrganization;
  if (org && typeof org === "object" && typeof (org as Record<string, unknown>).name === "string") {
    return ((org as Record<string, unknown>).name as string).trim() || null;
  }
  return null;
}

function locationText(node: Record<string, unknown>): string | null {
  const raw = node.jobLocation;
  const places = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const parts: string[] = [];
  for (const place of places) {
    if (!place || typeof place !== "object") continue;
    const address = (place as Record<string, unknown>).address;
    if (typeof address === "string") {
      parts.push(address);
      continue;
    }
    if (address && typeof address === "object") {
      const a = address as Record<string, unknown>;
      const line = [a.addressLocality, a.addressRegion, a.addressCountry]
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .join(", ");
      if (line) parts.push(line);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function titleText(node: Record<string, unknown>): string | null {
  if (typeof node.title === "string" && node.title.trim()) return node.title.trim();
  const id = node.identifier;
  if (id && typeof id === "object" && typeof (id as Record<string, unknown>).name === "string") {
    // Some Workday blocks stash the human title in identifier.name and leave "title" unset.
    const name = ((id as Record<string, unknown>).name as string).trim();
    if (name) return name;
  }
  return null;
}

/** Returns the first plausible JobPosting found in the document's JSON-LD, or null. */
export function findJobPostingJsonLd(doc: Document): JsonLdJobPosting | null {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    const text = script.textContent?.trim();
    if (!text) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      continue;
    }

    const nodes: Record<string, unknown>[] = [];
    collectNodes(parsed, nodes);

    const node = nodes.find(looksLikeJobPosting);
    if (!node) continue;

    const descriptionRaw = typeof node.description === "string" ? node.description : "";
    return {
      title: titleText(node),
      descriptionText: jsonLdDescriptionToText(descriptionRaw),
      company: orgName(node),
      location: locationText(node),
      salary: parseJsonLdBaseSalary(node.baseSalary),
    };
  }
  return null;
}
