import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearRemoteCache, extractFromRemote } from "@/adapters/webextension/remote-posting";
import { adapterFor } from "@/core/sites/registry";
import { LINKEDIN_GUEST_WITH_SIMILAR_JOBS, NOT_A_JOB_PAGE } from "@/core/sites/fixtures";

const PAGE = new URL(
  "https://www.linkedin.com/jobs/search-results/?currentJobId=4464579833&keywords=Machine%20Learning%20Engineer",
);
const adapter = adapterFor(PAGE)!;

const ok = (html: string) => Promise.resolve({ ok: true, text: () => Promise.resolve(html) });

describe("extractFromRemote", () => {
  beforeEach(() => clearRemoteCache());

  it("fetches the public copy without credentials and extracts the posting from it", async () => {
    const doFetch = vi.fn().mockReturnValue(ok(LINKEDIN_GUEST_WITH_SIMILAR_JOBS));

    const posting = await extractFromRemote(adapter, PAGE, doFetch);

    expect(doFetch).toHaveBeenCalledWith("https://www.linkedin.com/jobs/view/4464579833/", { credentials: "omit" });
    expect(posting).toMatchObject({
      title: "Data Scientist / Analytics Engineer",
      company: "Audiobooks.com",
      location: "Burlington, Ontario, Canada",
      sourceUrl: "https://www.linkedin.com/jobs/view/4464579833/",
    });
  });

  it("fetches once per job no matter how many times it's asked", async () => {
    const doFetch = vi.fn().mockReturnValue(ok(LINKEDIN_GUEST_WITH_SIMILAR_JOBS));

    await extractFromRemote(adapter, PAGE, doFetch);
    await extractFromRemote(adapter, PAGE, doFetch);

    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it("returns null (caller falls back to the live page) on a non-OK response", async () => {
    const doFetch = vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve("") });
    expect(await extractFromRemote(adapter, PAGE, doFetch)).toBeNull();
  });

  it("returns null when the fetch throws", async () => {
    const doFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await extractFromRemote(adapter, PAGE, doFetch)).toBeNull();
  });

  it("returns null for a page with nothing posting-shaped (e.g. a login wall)", async () => {
    const doFetch = vi.fn().mockReturnValue(ok(NOT_A_JOB_PAGE));
    expect(await extractFromRemote(adapter, PAGE, doFetch)).toBeNull();
  });

  it("doesn't fetch at all for an adapter or URL with no remote source", async () => {
    const doFetch = vi.fn();
    const shopify = adapterFor(new URL("https://www.shopify.com/careers/x_1"))!;
    expect(await extractFromRemote(shopify, new URL("https://www.shopify.com/careers/x_1"), doFetch)).toBeNull();
    expect(await extractFromRemote(adapter, new URL("https://www.linkedin.com/jobs/view/1/"), doFetch)).toBeNull();
    expect(doFetch).not.toHaveBeenCalled();
  });
});
