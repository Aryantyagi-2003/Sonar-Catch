// Extension settings live only in chrome.storage.local — never hardcoded, never logged.
// This is the one file allowed to touch chrome.storage directly.

export interface SonarSettings {
  sonarUrl: string;
  apiToken: string;
}

const STORAGE_KEY = "sonarSettings";

export async function getSonarSettings(): Promise<SonarSettings | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const settings = result[STORAGE_KEY] as SonarSettings | undefined;
  if (!settings?.sonarUrl || !settings?.apiToken) return null;
  return settings;
}

export async function setSonarSettings(settings: SonarSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}
