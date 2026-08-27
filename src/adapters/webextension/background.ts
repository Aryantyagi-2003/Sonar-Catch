import browser from "webextension-polyfill";

import { submitJobPosting, confirmJobPosting, lookupExistingApplication, type ExistingApplicationMatch } from "@/core/sonar-client";
import { composePostingText } from "@/core/compose-posting-text";
import { getSonarSettings } from "@/adapters/webextension/storage";
import type { ExtractedJobPosting } from "@/core/types";

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
  const lookupResult = await lookupExistingApplication(settings.sonarUrl, settings.apiToken, {
    company: posting.company,
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
browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as SendPostingMessage;
  if (msg?.type !== "SEND_POSTING") return undefined;
  return handleSendPosting(msg.posting, msg.dateApplied);
});

browser.action.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});
