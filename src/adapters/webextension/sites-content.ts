import browser from "webextension-polyfill";

import { adapterFor, healthStatusForMethod, type SiteAdapter } from "@/core/sites/registry";
import type { ExtractedJobPosting } from "@/core/types";
import type { ExistingApplicationMatch } from "@/core/sonar-client";
import { renderWidget, setSendHandler, type WidgetState } from "@/adapters/webextension/ui";
import { recordAdapterHealth } from "@/adapters/webextension/storage";

// The non-Indeed detection loop. Shares the widget and the background SEND_POSTING message
// (so the send/lookup/duplicate flow is byte-for-byte the same as Indeed's) but does its
// own DOM watching: these are Workday/Phenom SPAs that swap the posting in place and
// navigate via the History API, so we watch both the DOM and location.href.

const DEBOUNCE_MS = 500;
const URL_POLL_MS = 1000;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentPosting: ExtractedJobPosting | null = null;
let currentPostingDetectedAt: string | null = null;
let lastHref = "";

function widgetStateForPosting(posting: ExtractedJobPosting): WidgetState {
  return posting.detection?.confidence === "low"
    ? { kind: "detected-low-confidence", posting }
    : { kind: "detected", posting };
}

async function runExtraction(adapter: SiteAdapter): Promise<void> {
  const result = adapter.extract(document, window.location.href);

  if (result.status === "loading") return;

  if (result.status === "not-found") {
    currentPosting = null;
    renderWidget({ kind: "not-found" });
    await recordAdapterHealth({
      adapterId: adapter.id,
      adapterLabel: adapter.label,
      host: window.location.hostname,
      status: "failed",
      method: null,
      lastSeen: new Date().toISOString(),
      sampleTitle: null,
    });
    return;
  }

  const posting = result.posting;
  const changed =
    !currentPosting ||
    currentPosting.title !== posting.title ||
    currentPosting.descriptionText !== posting.descriptionText;

  currentPosting = posting;
  if (changed) {
    currentPostingDetectedAt = new Date().toISOString();
    renderWidget(widgetStateForPosting(posting));
  }

  const method = posting.detection?.method ?? null;
  await recordAdapterHealth({
    adapterId: adapter.id,
    adapterLabel: adapter.label,
    host: window.location.hostname,
    status: healthStatusForMethod(method),
    method,
    lastSeen: new Date().toISOString(),
    sampleTitle: posting.title,
  });
}

function scheduleExtraction(adapter: SiteAdapter, immediate = false): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (immediate) {
    void runExtraction(adapter);
    return;
  }
  debounceTimer = setTimeout(() => void runExtraction(adapter), DEBOUNCE_MS);
}

async function handleSendClick(): Promise<void> {
  if (!currentPosting) return;
  renderWidget({ kind: "sending" });

  const dateApplied = currentPostingDetectedAt ?? new Date().toISOString();

  type SendPostingResponse =
    | { ok: true; applicationId: string }
    | { ok: false; error: string }
    | { ok: false; duplicate: true; match: ExistingApplicationMatch; existingUrl: string };

  let response: SendPostingResponse | undefined;
  try {
    response = (await browser.runtime.sendMessage({
      type: "SEND_POSTING",
      posting: currentPosting,
      dateApplied,
    })) as SendPostingResponse | undefined;
  } catch {
    response = undefined;
  }

  if (!response) {
    renderWidget({ kind: "error", message: "Couldn't reach the extension background — try again." });
    return;
  }

  const state: WidgetState = response.ok
    ? { kind: "sent", applicationId: response.applicationId }
    : "duplicate" in response
      ? { kind: "already-logged", match: response.match, existingUrl: response.existingUrl }
      : { kind: "error", message: response.error };
  renderWidget(state);

  setTimeout(() => {
    if (currentPosting) renderWidget(widgetStateForPosting(currentPosting));
  }, 2500);
}

export async function startSiteAdapters(): Promise<void> {
  const adapter = adapterFor(new URL(window.location.href));
  // The manifest only injects this script on hosts that have an adapter, so this is just a
  // guard against a future manifest/registry mismatch — stay silent rather than showing a
  // misleading "couldn't detect" on a page we were never meant to read.
  if (!adapter) return;

  setSendHandler(handleSendClick);
  lastHref = window.location.href;

  const observer = new MutationObserver(() => scheduleExtraction(adapter));
  observer.observe(document.body, { childList: true, subtree: true });

  // SPA route changes don't touch the DOM subtree in a way the observer above always
  // catches — poll the URL as well and re-extract immediately when it changes.
  setInterval(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      scheduleExtraction(adapter, true);
    }
  }, URL_POLL_MS);

  scheduleExtraction(adapter, true);
}
