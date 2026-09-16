import { describe, expect, it } from "vitest";

import { canonicalLinkedInJobUrl } from "@/core/sites/linkedin-url";

describe("canonicalLinkedInJobUrl", () => {
  it("canonicalizes a split-view search URL's currentJobId param", () => {
    const messy =
      "https://www.linkedin.com/jobs/search/?currentJobId=4419969671&keywords=software%20engineer&location=Remote&trackingId=abc123";
    expect(canonicalLinkedInJobUrl(messy)).toBe("https://www.linkedin.com/jobs/view/4419969671/");
  });

  it("canonicalizes a slugged /jobs/view/ URL down to just the id", () => {
    const slugged = "https://www.linkedin.com/jobs/view/senior-software-engineer-at-general-motors-4419969671";
    expect(canonicalLinkedInJobUrl(slugged)).toBe("https://www.linkedin.com/jobs/view/4419969671/");
  });

  it("leaves an already-canonical URL alone", () => {
    expect(canonicalLinkedInJobUrl("https://www.linkedin.com/jobs/view/4419969671/")).toBe(
      "https://www.linkedin.com/jobs/view/4419969671/",
    );
  });

  it("falls back to the raw URL when no job id is identifiable", () => {
    const noId = "https://www.linkedin.com/jobs/search/?keywords=engineer";
    expect(canonicalLinkedInJobUrl(noId)).toBe(noId);
  });

  it("never throws on a malformed URL", () => {
    expect(canonicalLinkedInJobUrl("not a url")).toBe("not a url");
  });
});
