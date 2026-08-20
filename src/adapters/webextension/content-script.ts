import browser from "webextension-polyfill";

import { extractIndeedJobPosting } from "@/core/indeed/extract";
import { DETAIL_PANE_SELECTORS, SKELETON_CLASS, SKELETON_TEST_ID } from "@/core/indeed/selectors";
import type { ExtractedJobPosting } from "@/core/types";
import { renderWidget, setSendHandler, type WidgetState } from "@/adapters/webextension/ui";
// ui.css is injected via manifest.json's content_scripts.css, not imported here — that's
// the standard MV3 mechanism and avoids CSP issues with injecting <style> via JS.

const DEBOUNCE_MS = 400;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let currentPosting: ExtractedJobPosting | null = null;

function findObserveTarget(): Node {
  for (const selector of DETAIL_PANE_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return document.body;
}

function runExtraction(): void {
  const result = extractIndeedJobPosting(document, window.location.href);

  if (result.status === "loading") {
    // Mid-transition — don't flicker to "not found" between two valid postings.
    return;
  }

  if (result.status === "not-found") {
    currentPosting = null;
    renderWidget({ kind: "not-found" });
    return;
  }

  // Only re-render (and re-pulse) when the detected posting actually changed, so
  // unrelated DOM churn on the page doesn't reset the "just updated" animation.
  const changed =
    !currentPosting ||
    currentPosting.title !== result.posting.title ||
    currentPosting.company !== result.posting.company ||
    currentPosting.descriptionText !== result.posting.descriptionText;

  currentPosting = result.posting;

  if (changed) {
    renderWidget({ kind: "detected", posting: result.posting });
  }
}

function scheduleExtraction(immediate = false): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (immediate) {
    runExtraction();
    return;
  }
  debounceTimer = setTimeout(runExtraction, DEBOUNCE_MS);
}

function mutationRemovedSkeleton(mutations: MutationRecord[]): boolean {
  for (const mutation of mutations) {
    for (const node of Array.from(mutation.removedNodes)) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      if (el.classList?.contains(SKELETON_CLASS)) return true;
      if (el.getAttribute?.("data-testid") === SKELETON_TEST_ID) return true;
      if (el.querySelector?.(`[data-testid="${SKELETON_TEST_ID}"]`)) return true;
    }
  }
  return false;
}

function observe(): void {
  const observer = new MutationObserver((mutations) => {
    // The skeleton's removal is the strongest "content just finished loading" signal —
    // jump the debounce queue for it instead of waiting the full window.
    scheduleExtraction(mutationRemovedSkeleton(mutations));
  });

  observer.observe(findObserveTarget(), { childList: true, subtree: true });

  // If Indeed re-renders the detail pane's own wrapper (not just its children), the
  // originally-observed node can become stale — periodically re-anchor the observer to
  // whatever currently matches, cheaply, without tearing down debounce state.
  setInterval(() => {
    observer.disconnect();
    observer.observe(findObserveTarget(), { childList: true, subtree: true });
  }, 5000);
}

async function handleSendClick(): Promise<void> {
  if (!currentPosting) return;
  renderWidget({ kind: "sending" });

  let response: { ok: true; applicationId: string } | { ok: false; error: string } | undefined;
  try {
    response = (await browser.runtime.sendMessage({ type: "SEND_POSTING", posting: currentPosting })) as
      | { ok: true; applicationId: string }
      | { ok: false; error: string }
      | undefined;
  } catch {
    response = undefined;
  }

  if (!response) {
    renderWidget({ kind: "error", message: "Couldn't reach the extension background — try again." });
    return;
  }

  const state: WidgetState = response.ok
    ? { kind: "sent", applicationId: response.applicationId }
    : { kind: "error", message: response.error };
  renderWidget(state);

  // Return to the normal "detected" state after a moment so the widget is ready for the
  // next posting the user clicks to, rather than getting stuck on a stale toast.
  setTimeout(() => {
    if (currentPosting) renderWidget({ kind: "detected", posting: currentPosting });
  }, 2500);
}

setSendHandler(handleSendClick);
observe();
scheduleExtraction(true);
