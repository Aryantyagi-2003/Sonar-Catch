import { describe, expect, it } from "vitest";

import { canonicalCompanyName } from "@/core/canonical-company";

describe("canonicalCompanyName", () => {
  it("strips a Workday tenant's leading numeric store code and legal suffix", () => {
    expect(canonicalCompanyName("050 Best Buy Canada Ltd.")).toBe("Best Buy Canada");
  });

  it("strips a trailing regional parenthetical", () => {
    expect(canonicalCompanyName("Canadian Imperial Bank of Commerce (Canada)")).toBe("CIBC");
  });

  it("aliases a variant legal-entity name to the same canonical company", () => {
    expect(canonicalCompanyName("CIBC Bank USA")).toBe("CIBC");
  });

  it("aliases a full legal name to its known short form", () => {
    expect(canonicalCompanyName("Royal Bank of Canada")).toBe("RBC");
  });

  it("strips a bare legal suffix with no alias available", () => {
    expect(canonicalCompanyName("Walmart Inc.")).toBe("Walmart");
  });

  it("leaves an already-clean name with no alias untouched", () => {
    expect(canonicalCompanyName("General Motors")).toBe("General Motors");
  });

  it("is idempotent", () => {
    const once = canonicalCompanyName("050 Best Buy Canada Ltd.");
    expect(canonicalCompanyName(once)).toBe(once);
  });

  it("never widens an empty or unknown-format company into something else", () => {
    expect(canonicalCompanyName("")).toBe("");
    expect(canonicalCompanyName("Unknown company")).toBe("Unknown company");
  });
});
