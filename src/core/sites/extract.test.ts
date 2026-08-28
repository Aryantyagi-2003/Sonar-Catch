import { describe, expect, it } from "vitest";

import { adapterFor, healthStatusForMethod, ADAPTER_META } from "@/core/sites/registry";
import {
  WORKDAY_JSONLD,
  WORKDAY_JSONLD_TYPED,
  WORKDAY_DOM_ONLY,
  WORKDAY_BROKEN,
  PHENOM_JSONLD,
  PHENOM_DOM_ONLY,
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

describe("adapterFor — host routing", () => {
  it("routes each target host to its own named adapter", () => {
    expect(adapterFor(new URL(RBC_URL))?.id).toBe("rbc");
    expect(adapterFor(new URL(WALMART_URL))?.id).toBe("walmart");
    expect(adapterFor(new URL(BESTBUY_URL))?.id).toBe("bestbuy-ca");
    expect(adapterFor(new URL(CIBC_URL))?.id).toBe("cibc");
  });

  it("does not claim Indeed or unrelated hosts", () => {
    expect(adapterFor(new URL("https://www.indeed.com/jobs?q=x"))).toBeNull();
    expect(adapterFor(new URL("https://example.com/careers/job/1"))).toBeNull();
    // A different Workday tenant is intentionally not covered — no silent guessing.
    expect(adapterFor(new URL("https://nvidia.wd5.myworkdayjobs.com/job/x"))).toBeNull();
  });

  it("exposes one metadata row per adapter for the options page", () => {
    expect(ADAPTER_META.map((m) => m.id).sort()).toEqual(["bestbuy-ca", "cibc", "rbc", "walmart"]);
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
