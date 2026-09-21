import { describe, expect, it } from "vitest";

import { adapterFor, healthStatusForMethod, ADAPTER_META } from "@/core/sites/registry";
import {
  WORKDAY_JSONLD,
  WORKDAY_JSONLD_TYPED,
  WORKDAY_DOM_ONLY,
  WORKDAY_BROKEN,
  PHENOM_JSONLD,
  PHENOM_DOM_ONLY,
  LINKEDIN_JSONLD,
  LINKEDIN_DOM_ONLY,
  LINKEDIN_GUEST_DOM_ONLY,
  LINKEDIN_BROKEN,
  LINKEDIN_GUEST_WITH_SIMILAR_JOBS,
  SHOPIFY_JOB,
  SHOPIFY_LISTING,
  NOT_A_JOB_PAGE,
} from "@/core/sites/fixtures";

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

const CIBC_URL = "https://cibc.wd3.myworkdayjobs.com/en-US/search/job/Toronto-ON/Sr-Consultant_2614592";
const BESTBUY_URL =
  "https://bestbuycanada.wd3.myworkdayjobs.com/en-US/BestBuyCA_Career/job/11936-London/Merchandiser_R-52702";
const RBC_URL = "https://jobs.rbc.com/ca/en/job/RBCAA0088R0000167419EXTERNALENCA/Senior-ServiceNow-Engineer";
const WALMART_URL = "https://careers.walmart.com/us/jobs/0000-senior-manager";
const LINKEDIN_URL = "https://www.linkedin.com/jobs/view/4419969671/";
const LINKEDIN_SEARCH_URL = "https://www.linkedin.com/jobs/search/?currentJobId=4419969671";
const LINKEDIN_SEARCH_RESULTS_URL =
  "https://www.linkedin.com/jobs/search-results/?currentJobId=4464579833&showHowYouFit=HOW_YOU_FIT&keywords=Machine%20Learning%20Engineer&origin=QUALIFICATION_LANDING&geoId=90009534";
const SHOPIFY_URL = "https://www.shopify.com/careers/senior-compliance-analyst_8639c248-b9f3-45ca-9ea8-5b66a4c7d208";

describe("adapterFor — host routing", () => {
  it("routes each target host to its own named adapter", () => {
    expect(adapterFor(new URL(RBC_URL))?.id).toBe("rbc");
    expect(adapterFor(new URL(WALMART_URL))?.id).toBe("walmart");
    expect(adapterFor(new URL(BESTBUY_URL))?.id).toBe("bestbuy-ca");
    expect(adapterFor(new URL(CIBC_URL))?.id).toBe("cibc");
    expect(adapterFor(new URL(LINKEDIN_URL))?.id).toBe("linkedin");
    expect(adapterFor(new URL(LINKEDIN_SEARCH_URL))?.id).toBe("linkedin");
    expect(adapterFor(new URL(LINKEDIN_SEARCH_RESULTS_URL))?.id).toBe("linkedin");
    expect(adapterFor(new URL(SHOPIFY_URL))?.id).toBe("shopify");
    expect(adapterFor(new URL("https://www.shopify.com/careers"))?.id).toBe("shopify");
  });

  it("does not claim Indeed or unrelated hosts", () => {
    expect(adapterFor(new URL("https://www.indeed.com/jobs?q=x"))).toBeNull();
    expect(adapterFor(new URL("https://example.com/careers/job/1"))).toBeNull();
    // A different Workday tenant is intentionally not covered — no silent guessing.
    expect(adapterFor(new URL("https://nvidia.wd5.myworkdayjobs.com/job/x"))).toBeNull();
  });

  it("only claims LinkedIn's /jobs/ paths, not feed/profile/messaging pages", () => {
    expect(adapterFor(new URL("https://www.linkedin.com/feed/"))).toBeNull();
    expect(adapterFor(new URL("https://www.linkedin.com/in/someone/"))).toBeNull();
    expect(adapterFor(new URL("https://www.linkedin.com/messaging/"))).toBeNull();
  });

  it("only claims Shopify's /careers, not the rest of shopify.com", () => {
    expect(adapterFor(new URL("https://www.shopify.com/"))).toBeNull();
    expect(adapterFor(new URL("https://www.shopify.com/pricing"))).toBeNull();
    expect(adapterFor(new URL("https://www.shopify.com/careersfoo"))).toBeNull();
  });

  it("exposes one metadata row per adapter for the options page", () => {
    expect(ADAPTER_META.map((m) => m.id).sort()).toEqual(["bestbuy-ca", "cibc", "linkedin", "rbc", "shopify", "walmart"]);
  });
});

describe("Workday adapter", () => {
  it("Tier 1: reads the JSON-LD JobPosting and reports high confidence", () => {
    const adapter = adapterFor(new URL(BESTBUY_URL))!;
    const result = adapter.extract(parse(WORKDAY_JSONLD), BESTBUY_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Merchandiser (Part Time)");
    // Clean per-adapter label wins over "050 Best Buy Canada Ltd." from the page.
    expect(result.posting.company).toBe("Best Buy Canada");
    expect(result.posting.location).toBe("11936 London, Canada");
    expect(result.posting.descriptionText).toContain("hiring a merchandiser");
    expect(result.posting.salary?.raw).toContain("$17.60");
    expect(result.posting.detection).toMatchObject({
      adapterId: "bestbuy-ca",
      method: "json-ld",
      confidence: "high",
    });
  });

  it("Tier 1: the real block shape (@type serialized last) extracts end-to-end", () => {
    const adapter = adapterFor(new URL(CIBC_URL))!;
    const result = adapter.extract(parse(WORKDAY_JSONLD_TYPED), CIBC_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Director, Network Engineering");
    expect(result.posting.company).toBe("CIBC"); // not "Canadian Imperial Bank of Commerce (Canada)"
    expect(result.posting.location).toBe("Toronto-81 Bay, Ontario, Canada");
    expect(result.posting.salary?.min).toBe(165000);
    expect(result.posting.detection).toMatchObject({ method: "json-ld", confidence: "high" });
  });

  it("Tier 2: falls to data-automation-id selectors when JSON-LD is absent", () => {
    const adapter = adapterFor(new URL(CIBC_URL))!;
    const result = adapter.extract(parse(WORKDAY_DOM_ONLY), CIBC_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Sr. Consultant, Application Development");
    expect(result.posting.company).toBe("CIBC");
    expect(result.posting.detection).toMatchObject({ method: "selector", confidence: "high" });
  });

  it("Tier 3: JSON-LD gone AND selectors renamed -> generic fallback, low confidence", () => {
    const adapter = adapterFor(new URL(CIBC_URL))!;
    const result = adapter.extract(parse(WORKDAY_BROKEN), CIBC_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.detection).toMatchObject({ method: "structural", confidence: "low" });
    expect(result.posting.title).toBe("Sr. Consultant, Application Development");
    expect(result.posting.descriptionText).toContain("digital transformation");
    expect(result.posting.descriptionText).not.toContain("Cookie preferences");
    expect(result.posting.salary?.min).toBe(95000);
  });
});

describe("Phenom adapter", () => {
  it("Tier 1: reads JSON-LD and untangles the double-escaped-HTML description", () => {
    const adapter = adapterFor(new URL(RBC_URL))!;
    const result = adapter.extract(parse(PHENOM_JSONLD), RBC_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Senior ServiceNow Discovery & Service Mapping Engineer");
    expect(result.posting.company).toBe("RBC");
    expect(result.posting.location).toBe("TORONTO, Ontario, Canada");
    expect(result.posting.descriptionText).toContain("WHAT IS THE OPPORTUNITY?");
    // Tags and entities are gone, not passed through literally.
    expect(result.posting.descriptionText).not.toContain("&lt;");
    expect(result.posting.descriptionText).not.toContain("<p>");
    expect(result.posting.descriptionText).toContain("Discovery & Service Mapping Engineer");
    expect(result.posting.detection).toMatchObject({ method: "json-ld", confidence: "high" });
  });

  it("Tier 2: falls to data-ph-at-id selectors when JSON-LD is absent", () => {
    const adapter = adapterFor(new URL(RBC_URL))!;
    const result = adapter.extract(parse(PHENOM_DOM_ONLY), RBC_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Associate");
    expect(result.posting.detection).toMatchObject({ method: "selector", confidence: "high" });
  });
});

describe("LinkedIn adapter", () => {
  it("Tier 1: reads JSON-LD, and extracts company FROM THE PAGE (multi-tenant, no fixed label)", () => {
    const adapter = adapterFor(new URL(LINKEDIN_URL))!;
    const result = adapter.extract(parse(LINKEDIN_JSONLD), LINKEDIN_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Senior Software Engineer – Go (Golang)");
    expect(result.posting.company).toBe("General Motors");
    expect(result.posting.location).toBe("Warren, MI, US");
    expect(result.posting.salary?.min).toBe(140000);
    expect(result.posting.detection).toMatchObject({ adapterId: "linkedin", method: "json-ld", confidence: "high" });
  });

  it("canonicalizes a messy split-view search URL to the stable /jobs/view/<id>/ form", () => {
    const adapter = adapterFor(new URL(LINKEDIN_SEARCH_URL))!;
    const result = adapter.extract(parse(LINKEDIN_JSONLD), LINKEDIN_SEARCH_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.sourceUrl).toBe("https://www.linkedin.com/jobs/view/4419969671/");
  });

  it("Tier 2: falls to the authenticated split-view SPA's selectors when JSON-LD is absent", () => {
    const adapter = adapterFor(new URL(LINKEDIN_URL))!;
    const result = adapter.extract(parse(LINKEDIN_DOM_ONLY), LINKEDIN_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Staff Software Engineer");
    expect(result.posting.company).toBe("Acme Corp");
    expect(result.posting.location).toBe("Toronto, ON, Canada");
    expect(result.posting.detection).toMatchObject({ method: "selector", confidence: "high" });
  });

  it("Tier 2: also falls to the GUEST page's selectors when JSON-LD is absent", () => {
    const adapter = adapterFor(new URL(LINKEDIN_URL))!;
    const result = adapter.extract(parse(LINKEDIN_GUEST_DOM_ONLY), LINKEDIN_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Backend Engineer");
    expect(result.posting.company).toBe("Acme Corp");
    expect(result.posting.detection).toMatchObject({ method: "selector", confidence: "high" });
  });

  it("Tier 3: neither JSON-LD nor any known selector matched -> generic fallback, low confidence", () => {
    const adapter = adapterFor(new URL(LINKEDIN_URL))!;
    const result = adapter.extract(parse(LINKEDIN_BROKEN), LINKEDIN_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.detection).toMatchObject({ method: "structural", confidence: "low" });
    expect(result.posting.title).toBe("Staff Software Engineer");
    expect(result.posting.descriptionText).toContain("lead our platform team");
    expect(result.posting.descriptionText).not.toContain("My Network");
    // Multi-tenant + generic tier has no company selector to fall back to — honest
    // "Unknown company" rather than a guess, consistent with the low-confidence label
    // already telling the user to double check before sending.
    expect(result.posting.company).toBe("Unknown company");
  });
});

describe("LinkedIn adapter — public-copy source for the logged-in split view", () => {
  it("points at the public /jobs/view/<id>/ page for any URL carrying currentJobId", () => {
    const adapter = adapterFor(new URL(LINKEDIN_SEARCH_RESULTS_URL))!;
    expect(adapter.remoteSource?.(new URL(LINKEDIN_SEARCH_RESULTS_URL))).toBe(
      "https://www.linkedin.com/jobs/view/4464579833/",
    );
    expect(adapter.remoteSource?.(new URL(LINKEDIN_SEARCH_URL))).toBe("https://www.linkedin.com/jobs/view/4419969671/");
  });

  it("has no remote source without a numeric currentJobId (e.g. already on a /jobs/view/ page)", () => {
    const adapter = adapterFor(new URL(LINKEDIN_URL))!;
    expect(adapter.remoteSource?.(new URL(LINKEDIN_URL))).toBeNull();
    expect(adapter.remoteSource?.(new URL("https://www.linkedin.com/jobs/search-results/?currentJobId=abc"))).toBeNull();
    expect(adapter.remoteSource?.(new URL("https://www.linkedin.com/jobs/search-results/"))).toBeNull();
  });

  it("guest page: reports the open job's own location, not a 'similar jobs' card's", () => {
    const adapter = adapterFor(new URL(LINKEDIN_URL))!;
    const result = adapter.extract(parse(LINKEDIN_GUEST_WITH_SIMILAR_JOBS), LINKEDIN_SEARCH_RESULTS_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.posting.title).toBe("Data Scientist / Analytics Engineer");
    expect(result.posting.company).toBe("Audiobooks.com");
    expect(result.posting.location).toBe("Burlington, Ontario, Canada");
    expect(result.posting.sourceUrl).toBe("https://www.linkedin.com/jobs/view/4464579833/");
    expect(result.posting.detection).toMatchObject({ method: "selector", confidence: "high" });
  });
});

describe("Shopify adapter", () => {
  it("Tier 2: reads the microdata/heading structure (Shopify ships no JSON-LD)", () => {
    const adapter = adapterFor(new URL(SHOPIFY_URL))!;
    const result = adapter.extract(parse(SHOPIFY_JOB), SHOPIFY_URL);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    // First <h1>, not the "We hire people, not resumes" banner further down.
    expect(result.posting.title).toBe("Senior Compliance Analyst");
    expect(result.posting.company).toBe("Shopify");
    // The pin-icon <li>, not the department <li> after it.
    expect(result.posting.location).toBe("Remote - Americas");
    expect(result.posting.descriptionText).toContain("Compliance Team ensures");
    expect(result.posting.descriptionText).toContain("Own day-to-day compliance");
    // Footer / "About Shopify" boilerplate sit outside the description microdata.
    expect(result.posting.descriptionText).not.toContain("Opportunity is not evenly distributed");
    expect(result.posting.sourceUrl).toBe(SHOPIFY_URL);
    expect(result.posting.detection).toMatchObject({ adapterId: "shopify", method: "selector", confidence: "high" });
  });

  it("only treats /careers/<slug>_<uuid> as a posting page", () => {
    const adapter = adapterFor(new URL(SHOPIFY_URL))!;
    expect(adapter.isPostingPage?.(new URL(SHOPIFY_URL))).toBe(true);
    expect(adapter.isPostingPage?.(new URL(`${SHOPIFY_URL}/`))).toBe(true);
    expect(adapter.isPostingPage?.(new URL("https://www.shopify.com/careers"))).toBe(false);
    expect(adapter.isPostingPage?.(new URL("https://www.shopify.com/careers/extraordinary"))).toBe(false);
    expect(adapter.isPostingPage?.(new URL("https://www.shopify.com/careers/search?keywords=ml"))).toBe(false);
  });

  it("does not turn a listing page into a posting through the dedicated tiers", () => {
    const adapter = adapterFor(new URL("https://www.shopify.com/careers"))!;
    // (The content script never calls extract here — isPostingPage gates it — but if it
    // did, a short listing must not pass as a confident posting.)
    expect(adapter.extract(parse(SHOPIFY_LISTING), "https://www.shopify.com/careers").status).toBe("not-found");
  });
});

describe("no plausible posting", () => {
  it("returns not-found rather than sending a thin/garbage extraction", () => {
    const adapter = adapterFor(new URL(RBC_URL))!;
    expect(adapter.extract(parse(NOT_A_JOB_PAGE), RBC_URL).status).toBe("not-found");
  });
});

describe("healthStatusForMethod", () => {
  it("maps detection method to an options-page status", () => {
    expect(healthStatusForMethod("json-ld")).toBe("dedicated");
    expect(healthStatusForMethod("selector")).toBe("dedicated");
    expect(healthStatusForMethod("structural")).toBe("fallback");
    expect(healthStatusForMethod(null)).toBe("failed");
  });
});
