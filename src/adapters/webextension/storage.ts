import browser from "webextension-polyfill";

// Extension settings live only in browser.storage.local — never hardcoded, never logged.
// This is the one file allowed to touch browser.storage directly. Uses the
// webextension-polyfill's `browser` namespace (promise-based) rather than `chrome.*`
// directly, so this same file runs unmodified on both Chrome and Firefox — Firefox
// implements `browser.*` natively, and the polyfill adds it to Chrome by wrapping
// `chrome.*`'s callback API.

export interface SonarSettings {
  sonarUrl: string;
  apiToken: string;
}

const STORAGE_KEY = "sonarSettings";

/** One row per named non-Indeed site adapter, last-write-wins, updated by the content
 *  script every time it runs on a matching page. Surfaced read-only on the options page so
 *  it's visible at a glance which companies' pages are being read via their dedicated
 *  adapter vs. having silently degraded to the generic fallback. */
export interface AdapterHealthRecord {
  adapterId: string;
  adapterLabel: string;
  host: string;
  /** "dedicated" = JSON-LD or platform selector hit; "fallback" = generic structural tier;
   *  "failed" = nothing plausible found. */
  status: "dedicated" | "fallback" | "failed";
  method: "json-ld" | "selector" | "structural" | null;
  lastSeen: string;
  sampleTitle: string | null;
}

const ADAPTER_HEALTH_KEY = "adapterHealth";

export async function getAdapterHealth(): Promise<Record<string, AdapterHealthRecord>> {
  const result = await browser.storage.local.get(ADAPTER_HEALTH_KEY);
  return (result[ADAPTER_HEALTH_KEY] as Record<string, AdapterHealthRecord> | undefined) ?? {};
}

export async function recordAdapterHealth(record: AdapterHealthRecord): Promise<void> {
  const current = await getAdapterHealth();
  current[record.adapterId] = record;
  await browser.storage.local.set({ [ADAPTER_HEALTH_KEY]: current });
}

export async function getSonarSettings(): Promise<SonarSettings | null> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] as SonarSettings | undefined;
  if (!settings?.sonarUrl || !settings?.apiToken) return null;
  return settings;
}

export async function setSonarSettings(settings: SonarSettings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}
