// Turns a JSON-LD `description` value into plain text. That value is inconsistent across
// the platforms we target:
//   - Workday (Best Buy CA, CIBC): already plain text, occasionally with a stray
//     numeric/HTML entity.
//   - Phenom (RBC): DOUBLE-escaped HTML — after JSON.parse you hold the literal string
//     "&lt;div&gt;&lt;p&gt;WHAT IS THE OPPORTUNITY..." (verified live 2026-08-28), often
//     with ~30 nested empty <div>s before the real content.
// Deliberately does NOT use innerHTML / DOMParser: this runs in the content script, and
// AMO's static analyzer flags any dynamic innerHTML on sight (see ui.ts's note).

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  bull: "•",
  middot: "·",
};

function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const codePoint =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      if (Number.isNaN(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return whole;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** JSON-LD description value (plain, HTML, or double-escaped HTML) -> collapsed plain text. */
export function jsonLdDescriptionToText(raw: string): string {
  let s = raw;
  // Double-escaped HTML: promote "&lt;p&gt;" back to real tags before stripping.
  if (/&lt;|&gt;/i.test(s)) s = decodeEntities(s);
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  // Keep paragraph/line breaks as spaces so words on either side of a tag don't fuse.
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  return s.replace(/\s+/g, " ").trim();
}
