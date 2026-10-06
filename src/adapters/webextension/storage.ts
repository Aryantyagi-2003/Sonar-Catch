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

// Diagnostics for the "Couldn't reach the extension background" failure mode, where the
// background script (an MV3 Chrome service worker, or a Firefox non-persistent event page)
// can go idle/unloaded between clicks. Firefox's about:debugging can fail to open an
// inspector toolbox for a background context that isn't currently running at all, which
// makes that background's own console log unreachable exactly when it would be most
// useful — so these timestamps are written to storage instead, where they're readable from
// the options page (an ordinary tab, always inspectable) regardless of whether the
// background happens to be alive at that moment.
export interface BackgroundDiagnostics {
  /** Set at module load, every time the background script (re)starts. If this is old or
   *  missing while postings are actively being detected, the background isn't starting at
   *  all — a manifest/script problem, not an idle-timing one. */
  scriptStartedAt: string | null;
  /** Set whenever a content script's long-lived keep-alive port connects. */
  lastPortConnectedAt: string | null;
  /** Set the moment a SEND_POSTING message is received, before any processing — proves the
   *  message reached a live listener, independent of whether handling it then succeeded. */
  lastMessageReceivedAt: string | null;
}

const BACKGROUND_DIAGNOSTICS_KEY = "backgroundDiagnostics";

export async function getBackgroundDiagnostics(): Promise<BackgroundDiagnostics> {
  const result = await browser.storage.local.get(BACKGROUND_DIAGNOSTICS_KEY);
  return (
    (result[BACKGROUND_DIAGNOSTICS_KEY] as BackgroundDiagnostics | undefined) ?? {
      scriptStartedAt: null,
      lastPortConnectedAt: null,
      lastMessageReceivedAt: null,
    }
  );
}

export async function recordBackgroundDiagnostic(
  field: keyof BackgroundDiagnostics,
  at: string = new Date().toISOString(),
): Promise<void> {
  const current = await getBackgroundDiagnostics();
  current[field] = at;
  await browser.storage.local.set({ [BACKGROUND_DIAGNOSTICS_KEY]: current });
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
