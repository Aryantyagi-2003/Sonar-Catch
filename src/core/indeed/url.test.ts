import { describe, expect, it } from "vitest";

import { canonicalIndeedJobUrl } from "./url";

describe("canonicalIndeedJobUrl", () => {
  it("normalizes a split-view vjk param to the viewjob URL", () => {
    expect(canonicalIndeedJobUrl("https://ca.indeed.com/jobs?q=java&l=Toronto&vjk=F750CA1C17BD7894")).toBe(
      "https://ca.indeed.com/viewjob?jk=f750ca1c17bd7894",
    );
  });

  it("keeps a viewjob URL's jk and drops tracking params", () => {
    expect(canonicalIndeedJobUrl("https://ca.indeed.com/viewjob?jk=f750ca1c17bd7894&from=serp&tk=abc")).toBe(
      "https://ca.indeed.com/viewjob?jk=f750ca1c17bd7894",
    );
  });

  it("gives two jobs opened from the homepage feed different URLs (real URLs, seen live)", () => {
    expect(canonicalIndeedJobUrl("https://ca.indeed.com/?r=us&vjk=979850eb0a39eed2")).toBe(
      "https://ca.indeed.com/viewjob?jk=979850eb0a39eed2",
    );
    expect(canonicalIndeedJobUrl("https://ca.indeed.com/?r=us&vjk=d101c0c2a3c68124")).toBe(
      "https://ca.indeed.com/viewjob?jk=d101c0c2a3c68124",
    );
  });

  it("returns null for the homepage feed with no job open, since it doesn't identify a single job", () => {
    expect(canonicalIndeedJobUrl("https://ca.indeed.com/?r=us")).toBeNull();
  });

  it("returns null for a malformed job key or URL", () => {
    expect(canonicalIndeedJobUrl("https://ca.indeed.com/jobs?vjk=not-a-key")).toBeNull();
    expect(canonicalIndeedJobUrl("not a url")).toBeNull();
  });
});
