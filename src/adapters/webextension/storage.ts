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

export async function getSonarSettings(): Promise<SonarSettings | null> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] as SonarSettings | undefined;
  if (!settings?.sonarUrl || !settings?.apiToken) return null;
  return settings;
}

export async function setSonarSettings(settings: SonarSettings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}
