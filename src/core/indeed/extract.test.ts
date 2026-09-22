import { describe, expect, it } from "vitest";

import { extractIndeedJobPosting } from "@/core/indeed/extract";
import {
  INDEED_SPLIT_VIEW_TIER1,
  INDEED_SPLIT_VIEW_STRUCTURAL_FALLBACK,
  INDEED_SPLIT_VIEW_LOADING,
  INDEED_SPLIT_VIEW_NO_JOB_SELECTED,
  INDEED_REACT_NATIVE_LAYOUT,
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

describe("extractIndeedJobPosting — new react-native-web layout (confirmed live 2026-09-22)", () => {
  // Regression: 0.1.6/0.1.7/0.1.8 all reported this posting wrong ("Unknown title", then a
  // "Job type" chip heading mistaken for the title) because Indeed's ENTIRE detail pane was
  // rebuilt on this new front end, not just the title element — none of the old
  // `.jobsearch-*` selectors exist in it at all. Fixed with real testid-based selectors read
  // directly from a real posting's DOM (see selectors.ts and fixtures.ts for provenance),
  // not another heuristic guess.
  const result = extractIndeedJobPosting(parse(INDEED_REACT_NATIVE_LAYOUT), "https://ca.indeed.com/viewjob?jk=f750ca1c17bd7894");

  it("finds the real title via [data-testid=\"vj-job-title\"], not a section heading", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Web Project Coordinator");
  });

  it("finds the company from the company-info-metadata link's visible text, not its aria-label", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.company).toBe("Rexel");
  });

  it("finds the description via its own semantic class, not the left-hand list", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.descriptionText).toContain("Web Project Coordinator for our");
    expect(result.posting.descriptionText).not.toContain("Warehouse Associate");
  });

  it("still recovers a salary via the regex fallback, even with no salary selector for this layout", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.salary?.raw?.toLowerCase()).toContain("year");
  });

  it("uses [data-testid=\"viewjob-main-content\"] as the pane, not the structural fallback", () => {
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.containerTier).toBe("selector");
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

  // Regression: 0.1.7 shipped headingTitle() without "job type" in its exclusion list, so
  // on a posting where DETAIL_TITLE_SELECTORS missed, it reported Indeed's "Job type" chip
  // heading as the job title instead of falling back further or finding the real one.
  it("skips the 'Job type' metadata chip heading, live 0.1.7 regression", () => {
    const html = pane(
      `<h1 class="new-title-abc123">Data Engineer</h1>
       <div class="job-metadata-chips"><h2>Job type</h2><span>Full-time</span></div>`,
    );
    const result = extractIndeedJobPosting(parse(html), "https://www.indeed.com/jobs");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Data Engineer");
  });

  it("prefers an h1 title over an earlier h2/h3 metadata chip in DOM order", () => {
    const html = pane(
      `<div class="job-metadata-chips"><h3>Pay</h3><span>$100,000 a year</span></div>
       <h1 class="new-title-abc123">Data Engineer</h1>`,
    );
    const result = extractIndeedJobPosting(parse(html), "https://www.indeed.com/jobs");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Data Engineer");
  });

  it("skips other known metadata chip headings (shift, location, benefits) when no h1 exists", () => {
    const html = pane(
      `<h3>Shift and schedule</h3><span>Day shift</span>
       <h2 class="new-abc">Senior Data Engineer</h2>
       <h3>Location</h3><span>Remote</span>
       <h3>Benefits</h3><span>Health insurance</span>`,
    );
    const result = extractIndeedJobPosting(parse(html), "https://www.indeed.com/jobs");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Senior Data Engineer");
  });
});
