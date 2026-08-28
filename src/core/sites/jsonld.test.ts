import { describe, expect, it } from "vitest";

import { findJobPostingJsonLd } from "@/core/sites/jsonld";
import { PHENOM_JSONLD, WORKDAY_JSONLD, WORKDAY_JSONLD_TYPED } from "@/core/sites/fixtures";

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("findJobPostingJsonLd", () => {
  it("matches the real Workday block (standard @type, serialized last)", () => {
    const ld = findJobPostingJsonLd(parse(WORKDAY_JSONLD_TYPED));
    expect(ld).not.toBeNull();
    expect(ld?.title).toBe("Director, Network Engineering");
    expect(ld?.company).toBe("Canadian Imperial Bank of Commerce (Canada)");
    expect(ld?.location).toBe("Toronto-81 Bay, Ontario, Canada");
    expect(ld?.descriptionText).toContain("relationship-oriented bank");
  });

  it("also accepts a block with NO @type as long as it has description + hiringOrganization", () => {
    const ld = findJobPostingJsonLd(parse(WORKDAY_JSONLD));
    expect(ld).not.toBeNull();
    expect(ld?.title).toBe("Merchandiser (Part Time)");
  });

  it("picks the JobPosting block, not a sibling WebPage block on the same page", () => {
    // PHENOM_JSONLD ships a WebPage block FIRST, then the JobPosting block.
    const ld = findJobPostingJsonLd(parse(PHENOM_JSONLD));
    expect(ld?.title).toBe("Senior ServiceNow Discovery & Service Mapping Engineer");
    expect(ld?.company).toBe("Royal Bank of Canada");
  });

  it("returns null when there is no JobPosting anywhere", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"WebPage","name":"x"}</script>
      <script type="application/ld+json">{"@type":"Organization","name":"y"}</script>
    </head><body></body></html>`;
    expect(findJobPostingJsonLd(parse(html))).toBeNull();
  });

  it("skips malformed JSON without throwing, and finds a later valid block", () => {
    const html = `<html><head>
      <script type="application/ld+json">{ not json ,,, }</script>
      <script type="application/ld+json">{"@type":"JobPosting","title":"Real Role","description":"${"x".repeat(150)}","hiringOrganization":{"name":"Co"}}</script>
    </head><body></body></html>`;
    expect(findJobPostingJsonLd(parse(html))?.title).toBe("Real Role");
  });

  it("unwraps an @graph array", () => {
    const html = `<html><head><script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[
        {"@type":"BreadcrumbList"},
        {"@type":"JobPosting","title":"Graphed Role","description":"${"y".repeat(150)}","hiringOrganization":{"name":"Co"}}
      ]}
    </script></head><body></body></html>`;
    expect(findJobPostingJsonLd(parse(html))?.title).toBe("Graphed Role");
  });
});
