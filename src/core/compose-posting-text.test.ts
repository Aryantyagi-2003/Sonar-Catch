import { describe, expect, it } from "vitest";

import { composePostingText } from "@/core/compose-posting-text";
import type { ExtractedJobPosting } from "@/core/types";

const base: ExtractedJobPosting = {
  title: "Senior Backend Engineer",
  company: "Nimbus Data",
  location: "Remote",
  salary: { min: 150000, max: 190000, raw: "$150,000 - $190,000 a year" },
  descriptionText: "We are looking for a Senior Backend Engineer...",
  sourceUrl: "https://www.indeed.com/viewjob?jk=abc",
  containerTier: "selector",
};

describe("composePostingText", () => {
  it("puts title, company, location, and salary above the description", () => {
    const text = composePostingText(base);
    const lines = text.split("\n");

    expect(lines[0]).toBe("Senior Backend Engineer");
    expect(lines[1]).toBe("Nimbus Data");
    expect(lines[2]).toBe("Remote");
    expect(lines[3]).toBe("$150,000 - $190,000 a year");
    expect(text).toContain("We are looking for a Senior Backend Engineer...");
  });

  it("omits missing location and salary lines instead of leaving blank placeholders", () => {
    const text = composePostingText({ ...base, location: null, salary: null });
    expect(text).not.toContain("null");
    expect(text.split("\n").slice(0, 2)).toEqual(["Senior Backend Engineer", "Nimbus Data"]);
  });
});
