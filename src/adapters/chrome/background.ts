import { submitJobPosting, confirmJobPosting } from "@/core/sonar-client";
import { composePostingText } from "@/core/compose-posting-text";
import { getSonarSettings } from "@/adapters/chrome/storage";
import type { ExtractedJobPosting } from "@/core/types";

type SendPostingMessage = { type: "SEND_POSTING"; posting: ExtractedJobPosting };
type SendPostingResponse = { ok: true; applicationId: string } | { ok: false; error: string };

async function handleSendPosting(posting: ExtractedJobPosting): Promise<SendPostingResponse> {
  const settings = await getSonarSettings();
  if (!settings) {
    return { ok: false, error: "Sonar Catch isn't configured yet — open the extension's options to set your Sonar URL and API token." };
  }

  const submitResult = await submitJobPosting(settings.sonarUrl, settings.apiToken, {
    jobPostingText: composePostingText(posting),
    sourceUrl: posting.sourceUrl,
  });

  if (!submitResult.ok) {
    return { ok: false, error: submitResult.error };
  }

  const confirmResult = await confirmJobPosting(settings.sonarUrl, settings.apiToken, submitResult.pendingToken);
  if (!confirmResult.ok) {
    return { ok: false, error: confirmResult.error };
  }

  return { ok: true, applicationId: confirmResult.applicationId };
}

chrome.runtime.onMessage.addListener((message: SendPostingMessage, _sender, sendResponse) => {
  if (message?.type !== "SEND_POSTING") return false;

  handleSendPosting(message.posting).then(sendResponse);
  return true; // keep the message channel open for the async sendResponse above
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});
