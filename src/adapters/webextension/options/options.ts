import browser from "webextension-polyfill";

import {
  getSonarSettings,
  setSonarSettings,
  getAdapterHealth,
  type AdapterHealthRecord,
} from "@/adapters/webextension/storage";
import { ADAPTER_META } from "@/core/sites/registry";

const form = document.getElementById("settings-form") as HTMLFormElement;
const sonarUrlInput = document.getElementById("sonarUrl") as HTMLInputElement;
const apiTokenInput = document.getElementById("apiToken") as HTMLInputElement;
const status = document.getElementById("status") as HTMLSpanElement;
const adapterHealthList = document.getElementById("adapter-health-list") as HTMLUListElement;

const HEALTH_LABELS: Record<AdapterHealthRecord["status"], string> = {
  dedicated: "Dedicated adapter",
  fallback: "Falling back to generic",
  failed: "Detection failed",
};

const METHOD_LABELS: Record<NonNullable<AdapterHealthRecord["method"]>, string> = {
  "json-ld": "JSON-LD",
  selector: "page selectors",
  structural: "generic heuristic",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

async function renderAdapterHealth(): Promise<void> {
  const health = await getAdapterHealth();
  adapterHealthList.replaceChildren();

  for (const meta of ADAPTER_META) {
    const record = health[meta.id];
    const item = document.createElement("li");
    item.className = "adapter-row";

    const badgeState = record ? record.status : "unseen";
    const badge = document.createElement("span");
    badge.className = `adapter-badge adapter-badge--${badgeState}`;
    badge.textContent = record ? HEALTH_LABELS[record.status] : "Not seen yet";

    const name = document.createElement("span");
    name.className = "adapter-name";
    name.textContent = `${meta.label} (${meta.platform})`;

    const detail = document.createElement("span");
    detail.className = "adapter-detail";
    detail.textContent = record
      ? `${record.method ? `via ${METHOD_LABELS[record.method]} · ` : ""}${relativeTime(record.lastSeen)}`
      : meta.hosts.join(", ");

    item.replaceChildren(badge, name, detail);
    adapterHealthList.appendChild(item);
  }
}

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
renderAdapterHealth();
