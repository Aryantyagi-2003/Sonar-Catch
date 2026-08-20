import browser from "webextension-polyfill";

import { getSonarSettings, setSonarSettings } from "@/adapters/webextension/storage";

const form = document.getElementById("settings-form") as HTMLFormElement;
const sonarUrlInput = document.getElementById("sonarUrl") as HTMLInputElement;
const apiTokenInput = document.getElementById("apiToken") as HTMLInputElement;
const status = document.getElementById("status") as HTMLSpanElement;

async function loadExistingSettings(): Promise<void> {
  const settings = await getSonarSettings();
  if (settings) {
    sonarUrlInput.value = settings.sonarUrl;
    apiTokenInput.value = settings.apiToken;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const sonarUrl = sonarUrlInput.value.trim().replace(/\/+$/, "");
  const apiToken = apiTokenInput.value.trim();

  let origin: string;
  try {
    origin = new URL(sonarUrl).origin;
  } catch {
    status.textContent = "Enter a valid URL, e.g. https://sonar.example.com";
    status.className = "error";
    return;
  }

  // The extension only ships fixed host permissions for indeed.com — the Sonar instance
  // is user-configured (localhost in dev, a real deployment later), so its origin is
  // requested at runtime rather than declared upfront. This keeps the extension's
  // install-time permission prompt narrow instead of asking for blanket network access.
  const granted = await browser.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) {
    status.textContent = "Sonar Catch needs permission to reach that URL to send postings — try again and allow it.";
    status.className = "error";
    return;
  }

  await setSonarSettings({ sonarUrl, apiToken });
  status.textContent = "Saved.";
  status.className = "success";
});

loadExistingSettings();
