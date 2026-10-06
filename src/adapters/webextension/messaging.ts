import browser from "webextension-polyfill";

import type { ExistingApplicationMatch } from "@/core/sonar-client";
import type { ExtractedJobPosting } from "@/core/types";

// Shared by content-script.ts (Indeed) and sites-content.ts (the other career sites) —
// both talk to the background script the same way, and both hit the same real failure
// mode: an MV3 background (a Chrome service worker, or Firefox's non-persistent event
// page) that's gone idle between the widget appearing and the user actually clicking
// "Send to Sonar", silently dropping that one message. See background.ts's onConnect
// listener and BackgroundDiagnostics in storage.ts for the other half of this.

export type SendPostingResponse =
  | { ok: true; applicationId: string }
  | { ok: false; error: string }
  | { ok: false; duplicate: true; match: ExistingApplicationMatch; existingUrl: string };

const RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Opens (and, if it drops, reopens) a long-lived port to the background script. Call once
 *  when a page's content script starts up. Keeping a port connected is the standard
 *  mitigation for an idle-timed-out background missing a later one-off `sendMessage` —
 *  connecting one resets the idle timer on both Chrome (service worker) and Firefox (event
 *  page) for as long as it stays open. Not a guarantee (Chrome still caps a service
 *  worker's total lifetime regardless), which is why sendPostingToBackground below also
 *  retries independently rather than relying on this alone. */
export function keepBackgroundAlive(): void {
  try {
    const port = browser.runtime.connect({ name: "sonar-catch-keepalive" });
    // A port the background drops (it restarted, or hit its lifetime cap) needs
    // reconnecting — otherwise every keep-alive connection made here would silently stop
    // working after the first background restart for the rest of this tab's lifetime.
    port.onDisconnect.addListener(() => keepBackgroundAlive());
  } catch (error) {
    // Connecting can throw if the extension context was already invalidated (e.g. the
    // extension was reloaded/updated while this tab stayed open) — nothing to reconnect to
    // in that case; the tab needs a real reload, which is outside a content script's power.
    console.error("[Sonar Catch] couldn't open the keep-alive port to the background:", error);
  }
}

async function trySend(posting: ExtractedJobPosting, dateApplied: string): Promise<SendPostingResponse | undefined> {
  try {
    return (await browser.runtime.sendMessage({
      type: "SEND_POSTING",
      posting,
      dateApplied,
    })) as SendPostingResponse | undefined;
  } catch (error) {
    // Logged rather than swallowed silently: this is the one place a genuine messaging
    // failure (background not running, "receiving end does not exist", extension context
    // invalidated after a reload) shows its real reason — visible in this page's own
    // DevTools console (F12). Filter the console for "Sonar Catch" to find it among a
    // busy page's own logging.
    console.error("[Sonar Catch] couldn't reach the background script:", error);
    return undefined;
  }
}

/** Sends the posting to the background script, retrying once after a short delay if the
 *  first attempt comes back empty — not just on a thrown/rejected error, but also on a
 *  silent `undefined` resolution, which is what an idle background failing to wake up in
 *  time can look like (no exception at all, just nobody answering). Returns undefined only
 *  if both attempts failed, at which point the caller shows the generic "couldn't reach"
 *  message for real. */
export async function sendPostingToBackground(
  posting: ExtractedJobPosting,
  dateApplied: string,
): Promise<SendPostingResponse | undefined> {
  const first = await trySend(posting, dateApplied);
  if (first) return first;

  await sleep(RETRY_DELAY_MS);
  return trySend(posting, dateApplied);
}
