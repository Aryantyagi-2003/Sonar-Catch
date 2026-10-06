import browser from "webextension-polyfill";

import { submitJobPosting, confirmJobPosting, lookupExistingApplication, type ExistingApplicationMatch } from "@/core/sonar-client";
import { composePostingText } from "@/core/compose-posting-text";
import { canonicalCompanyName } from "@/core/canonical-company";
import { getSonarSettings, recordBackgroundDiagnostic } from "@/adapters/webextension/storage";
import type { ExtractedJobPosting } from "@/core/types";

// Written unconditionally at load, before anything else — the one signal that survives even
// if everything below throws, and the thing to check first via the options page if sends
// keep failing: an old/missing timestamp here means the background isn't starting at all
// (manifest/script problem), not merely going idle between clicks. See storage.ts's
// BackgroundDiagnostics doc comment for why this goes to storage rather than console.log.
void recordBackgroundDiagnostic("scriptStartedAt");
console.log("[Sonar Catch] background script started", new Date().toISOString());

// A long-lived port from a content script keeps this background alive for as long as that
// port stays connected — both Chrome's MV3 service worker and Firefox's non-persistent
// event page reset their idle timer while one is open, which is the standard mitigation
// for "the background went idle and dropped a one-off sendMessage call" (both platforms'
// own extension docs recommend this). It's a mitigation, not an ironclad guarantee — Chrome
// in particular still caps how long a service worker can stay alive regardless — so
// messaging.ts's content-script side additionally retries a failed send once after a short
// delay rather than depending on this alone.
browser.runtime.onConnect.addListener((port) => {
  if (port.name !== "sonar-catch-keepalive") return;
  void recordBackgroundDiagnostic("lastPortConnectedAt");
});

type SendPostingMessage = { type: "SEND_POSTING"; posting: ExtractedJobPosting; dateApplied: string };
type SendPostingResponse =
  | { ok: true; applicationId: string }
  | { ok: false; error: string }
  | { ok: false; duplicate: true; match: ExistingApplicationMatch; existingUrl: string };

async function handleSendPosting(posting: ExtractedJobPosting, dateApplied: string): Promise<SendPostingResponse> {
  const settings = await getSonarSettings();
  if (!settings) {
    return { ok: false, error: "Sonar Catch isn't configured yet — open the extension's options to set your Sonar URL and API token." };
  }

  // Checked before /api/ingest, not after — catching the duplicate here also skips the
  // Gemini classification call that /api/ingest would otherwise burn on a posting we're
  // just going to throw away.
  //
  // This lookup is already cross-site by construction — it's one /api/ingest/lookup call
  // regardless of which adapter (Indeed, LinkedIn, or a direct career site) detected the
  // posting. canonicalCompanyName only smooths out one real source of false negatives:
  // the same employer being named differently depending on where the posting was found
  // (Indeed/LinkedIn extract whatever text the page uses; "Canadian Imperial Bank of
  // Commerce (Canada)" vs "CIBC" is a real example seen live). It does NOT touch the role
  // text (see that function's header comment for why), and it does not change what's
  // actually sent to Sonar's ingest/classification pipeline below — only this query. The
  // fuzzy-match decision of "is this really the same job" is still made server-side in
  // Sonar, which this extension has no visibility into.
  const lookupResult = await lookupExistingApplication(settings.sonarUrl, settings.apiToken, {
    company: canonicalCompanyName(posting.company),
    role: posting.title,
    sourceUrl: posting.sourceUrl,
  });
  if (lookupResult.ok && lookupResult.match) {
    return {
      ok: false,
      duplicate: true,
      match: lookupResult.match,
      existingUrl: `${settings.sonarUrl.replace(/\/+$/, "")}/applications/${lookupResult.match.id}`,
    };
  }

  const submitResult = await submitJobPosting(settings.sonarUrl, settings.apiToken, {
    jobPostingText: composePostingText(posting),
    sourceUrl: posting.sourceUrl,
  });

  if (!submitResult.ok) {
    return { ok: false, error: submitResult.error };
  }

  const confirmResult = await confirmJobPosting(settings.sonarUrl, settings.apiToken, submitResult.pendingToken, dateApplied);
  if (!confirmResult.ok) {
    return { ok: false, error: confirmResult.error };
  }

  return { ok: true, applicationId: confirmResult.applicationId };
}

// The polyfill's onMessage supports returning a Promise directly from the listener as the
// portable way to send an async response — this works natively in Firefox and is what the
// polyfill normalizes Chrome's sendResponse+"return true" callback pattern into, so the
// same listener body runs unmodified on both.
//
// handleSendPosting's own promise is never allowed to reject past this point. Every one of
// its calls (storage, fetch) already catches and returns an `{ ok: false, ... }` result, but
// if something unforeseen still throws (a storage API error, a bug), letting that rejection
// reach browser.runtime.sendMessage on the content-script side makes it indistinguishable
// from "no background to receive this at all" — the content script's own catch collapses
// both into the same generic "Couldn't reach the extension background" message, hiding a
// real (and possibly fixable) error behind a connectivity-sounding one. Catching it here
// instead surfaces the actual message in the widget, and logs it so it's visible from
// about:debugging's/chrome://extensions's background inspector without needing to
// reproduce the failure again.
browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as SendPostingMessage;
  if (msg?.type !== "SEND_POSTING") return undefined;
  void recordBackgroundDiagnostic("lastMessageReceivedAt");
  return handleSendPosting(msg.posting, msg.dateApplied).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("[Sonar Catch] handleSendPosting failed unexpectedly:", error);
    return { ok: false, error: `Unexpected extension error: ${reason}` } satisfies SendPostingResponse;
  });
});

browser.action.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});
