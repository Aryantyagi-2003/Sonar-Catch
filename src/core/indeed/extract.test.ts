import { describe, expect, it } from "vitest";

import { extractIndeedJobPosting } from "@/core/indeed/extract";
import {
  INDEED_SPLIT_VIEW_TIER1,
  INDEED_SPLIT_VIEW_STRUCTURAL_FALLBACK,
  INDEED_SPLIT_VIEW_LOADING,
  INDEED_SPLIT_VIEW_NO_JOB_SELECTED,
} from "@/core/indeed/fixtures";

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("extractIndeedJobPosting — Tier 1 (semantic selectors)", () => {
  const doc = parse(INDEED_SPLIT_VIEW_TIER1);
  const result = extractIndeedJobPosting(doc, "https://www.indeed.com/viewjob?jk=abc");

  it("extracts the right-pane posting", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Senior Backend Engineer");
    expect(result.posting.company).toBe("Nimbus Data");
    expect(result.posting.location).toBe("Remote");
    expect(result.posting.containerTier).toBe("selector");
  });

  it("captures the full description text", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.descriptionText).toContain("TypeScript, Node.js, and PostgreSQL");
    expect(result.posting.descriptionText).toContain("mentor junior engineers");
  });

  it("parses the salary range", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.salary).not.toBeNull();
    expect(result.posting.salary?.min).toBe(150000);
    expect(result.posting.salary?.max).toBe(190000);
  });

  it("never lets left-pane card content leak into the extracted title, company, or description", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const leakTerms = ["Staff Software Engineer", "Other Company Inc", "Austin, TX", "Django", "Backend Developer", "Third Company LLC"];
    const haystack = [result.posting.title, result.posting.company, result.posting.location, result.posting.descriptionText].join(" ");
    for (const term of leakTerms) {
      expect(haystack).not.toContain(term);
    }
  });
});

describe("extractIndeedJobPosting — salary regex regression", () => {
  // Caught via a real end-to-end run against a live Indeed posting on 2026-08-20: the
  // "a|an|per" alternation matched "a" before trying "an" (a valid prefix of "an"),
  // truncating "$50 - $100 an hour" down to "$50 - $100 a". "an" must be tried first.
  it("doesn't truncate 'an hour' down to 'a'", () => {
    const html = `
      <html><body>
        <div id="mosaic-provider-jobcards"></div>
        <div class="jobsearch-RightPane">
          <h1 class="jobsearch-JobInfoHeader-title">Staff Software Engineer</h1>
          <div id="jobDescriptionText">
            This is a fully remote contracting role with flexible scheduling and a
            supportive team. Pay range for this role is $50 - $100 an hour depending on
            experience level, paid out twice a month via direct deposit.
          </div>
        </div>
      </body></html>
    `;
    const result = extractIndeedJobPosting(parse(html), "https://www.indeed.com/jobs");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.salary?.raw).not.toBe("$50 - $100 a");
    expect(result.posting.salary?.raw?.toLowerCase()).toContain("hour");
    expect(result.posting.salary?.min).toBe(50);
    expect(result.posting.salary?.max).toBe(100);
  });
});

describe("extractIndeedJobPosting — Tier 2 (structural fallback)", () => {
  const doc = parse(INDEED_SPLIT_VIEW_STRUCTURAL_FALLBACK);
  const result = extractIndeedJobPosting(doc, "https://www.indeed.com/viewjob?jk=xyz");

  it("falls back to the largest non-list text block and marks the tier", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.containerTier).toBe("structural");
    expect(result.posting.descriptionText).toContain("Kubernetes infrastructure");
  });

  it("still excludes left-pane card content", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.descriptionText).not.toContain("Vue.js");
    expect(result.posting.descriptionText).not.toContain("Different Co");
  });
});

describe("extractIndeedJobPosting — loading and empty states", () => {
  it("reports 'loading' while the skeleton is present, rather than extracting stale/empty content", () => {
    const result = extractIndeedJobPosting(parse(INDEED_SPLIT_VIEW_LOADING), "https://www.indeed.com/jobs");
    expect(result.status).toBe("loading");
  });

  it("reports 'not-found' when no job is selected at all, rather than sending blank text", () => {
    const result = extractIndeedJobPosting(parse(INDEED_SPLIT_VIEW_NO_JOB_SELECTED), "https://www.indeed.com/jobs");
    expect(result.status).toBe("not-found");
  });

  it("reports 'not-found' on a page with no Indeed structure at all", () => {
    const result = extractIndeedJobPosting(parse("<html><body><p>Not Indeed</p></body></html>"), "https://example.com");
    expect(result.status).toBe("not-found");
  });
});

describe("extractIndeedJobPosting — title survives stale title selectors", () => {
  const pane = (header: string) => `
    <html><body>
      <div id="mosaic-provider-jobcards"><li data-testid="slider_item"><h2 class="jobTitle">Other Job</h2></li></div>
      <div class="jobsearch-RightPane">
        ${header}
        <div id="jobDescriptionText">
          <h2>Responsibilities</h2>
          You will build and operate data pipelines, partner with analysts, and own the
          reliability of our reporting stack across a fast-moving, fully remote team.
        </div>
        <h2>Job details</h2>
      </div>
    </body></html>`;

  it("falls back to the pane's first heading when no title selector matches", () => {
    const html = pane(`<div class="renamed-header"><h2 class="new-abc123">Data Engineer</h2>
      <div data-testid="inlineHeader-companyName">Acme</div></div>`);
    const result = extractIndeedJobPosting(parse(html), "https://www.indeed.com/jobs");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Data Engineer");
    expect(result.posting.company).toBe("Acme");
  });

  it("never picks a heading from the description body or a section label, or the left list", () => {
    const html = pane(`<div data-testid="inlineHeader-companyName">Acme</div>`);
    const result = extractIndeedJobPosting(parse(html), "https://www.indeed.com/jobs");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Unknown title");
  });

  it("strips Indeed's hidden ' - job post' suffix", () => {
    const html = pane(`<h1 class="jobsearch-JobInfoHeader-title">Data Engineer - job post</h1>`);
    const result = extractIndeedJobPosting(parse(html), "https://www.indeed.com/jobs");
    expect(result.status === "ok" && result.posting.title).toBe("Data Engineer");
  });
});
