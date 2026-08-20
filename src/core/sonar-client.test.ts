import { describe, expect, it, vi } from "vitest";

import { submitJobPosting, confirmJobPosting } from "@/core/sonar-client";

function fakeFetch(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe("submitJobPosting", () => {
  it("sends the Bearer token and posting text, and returns the pending token + extraction", async () => {
    const fetchImpl = fakeFetch(200, {
      status: "success",
      pendingToken: "tok123",
      extraction: { company: "Acme", role: "Engineer" },
    });

    const result = await submitJobPosting(
      "https://sonar.example.com",
      "sonar_pat_abc",
      { jobPostingText: "text", sourceUrl: "https://indeed.com/x" },
      fetchImpl,
    );

    expect(result).toEqual({
      ok: true,
      pendingToken: "tok123",
      extraction: { company: "Acme", role: "Engineer" },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://sonar.example.com/api/ingest",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer sonar_pat_abc" }),
      }),
    );
  });

  it("strips a trailing slash from the configured Sonar URL", async () => {
    const fetchImpl = fakeFetch(200, { pendingToken: "t", extraction: {} });
    await submitJobPosting("https://sonar.example.com/", "tok", { jobPostingText: "x", sourceUrl: null }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledWith("https://sonar.example.com/api/ingest", expect.anything());
  });

  it("surfaces the server's error message on a non-2xx response", async () => {
    const fetchImpl = fakeFetch(401, { error: "Invalid or revoked API token." });
    const result = await submitJobPosting("https://sonar.example.com", "bad", { jobPostingText: "x", sourceUrl: null }, fetchImpl);
    expect(result).toEqual({ ok: false, status: 401, error: "Invalid or revoked API token." });
  });

  it("returns a network-failure error without throwing when fetch rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const result = await submitJobPosting("https://sonar.example.com", "tok", { jobPostingText: "x", sourceUrl: null }, fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Couldn't reach Sonar/);
  });
});

describe("confirmJobPosting", () => {
  it("sends the pending token and returns the created applicationId", async () => {
    const fetchImpl = fakeFetch(200, { status: "success", applicationId: "app123" });
    const result = await confirmJobPosting("https://sonar.example.com", "tok", "pending-tok", fetchImpl);
    expect(result).toEqual({ ok: true, applicationId: "app123" });
  });

  it("surfaces a 410 expired-token error", async () => {
    const fetchImpl = fakeFetch(410, { error: "This extraction has expired or is invalid — reopen the posting and try again." });
    const result = await confirmJobPosting("https://sonar.example.com", "tok", "stale", fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(410);
  });
});
