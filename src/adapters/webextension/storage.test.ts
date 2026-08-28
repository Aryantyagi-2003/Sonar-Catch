import { describe, expect, it, vi, beforeEach } from "vitest";

// In-memory stand-in for browser.storage.local (jsdom has no extension APIs).
const store: Record<string, unknown> = {};
vi.mock("webextension-polyfill", () => ({
  default: {
    storage: {
      local: {
        get: vi.fn(async (key: string) => (key in store ? { [key]: store[key] } : {})),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(store, items);
        }),
      },
    },
  },
}));

import { getAdapterHealth, recordAdapterHealth, type AdapterHealthRecord } from "@/adapters/webextension/storage";

const rec = (over: Partial<AdapterHealthRecord>): AdapterHealthRecord => ({
  adapterId: "cibc",
  adapterLabel: "CIBC",
  host: "cibc.wd3.myworkdayjobs.com",
  status: "dedicated",
  method: "json-ld",
  lastSeen: "2026-08-28T12:00:00.000Z",
  sampleTitle: "Director, Network Engineering",
  ...over,
});

describe("adapter health storage — the data the options table renders", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });

  it("starts empty, so every adapter renders as 'Not seen yet'", async () => {
    expect(await getAdapterHealth()).toEqual({});
  });

  it("keeps one row per adapter, last-write-wins", async () => {
    await recordAdapterHealth(rec({ adapterId: "cibc", status: "dedicated", method: "json-ld" }));
    await recordAdapterHealth(rec({ adapterId: "rbc", adapterLabel: "RBC", host: "jobs.rbc.com", status: "dedicated" }));
    await recordAdapterHealth(rec({ adapterId: "cibc", status: "fallback", method: "structural" }));

    const health = await getAdapterHealth();
    expect(Object.keys(health).sort()).toEqual(["cibc", "rbc"]);
    expect(health.cibc).toMatchObject({ status: "fallback", method: "structural" });
    expect(health.rbc).toMatchObject({ status: "dedicated" });
  });

  it("records an honest 'failed' row when nothing was detected", async () => {
    await recordAdapterHealth(rec({ adapterId: "walmart", adapterLabel: "Walmart", status: "failed", method: null, sampleTitle: null }));
    expect((await getAdapterHealth()).walmart).toMatchObject({ status: "failed", method: null });
  });
});
