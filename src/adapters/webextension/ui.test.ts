import { describe, expect, it, beforeEach } from "vitest";

import { renderWidget } from "@/adapters/webextension/ui";
import type { ExtractedJobPosting } from "@/core/types";

const basePosting: ExtractedJobPosting = {
  title: "Director, Network Engineering",
  company: "CIBC",
  location: "Toronto, ON",
  salary: null,
  descriptionText: "x".repeat(400),
  sourceUrl: "https://cibc.wd3.myworkdayjobs.com/en-US/search/job/x",
};

function widget(): HTMLElement {
  return document.getElementById("sonar-catch-widget") as HTMLElement;
}

describe("renderWidget — the three detection outcomes are visually distinct", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("confident 'detected': navy --ready, a Send button, no review note", () => {
    renderWidget({
      kind: "detected",
      posting: { ...basePosting, detection: { adapterId: "cibc", adapterLabel: "CIBC", method: "json-ld", confidence: "high" } },
    });
    const w = widget();
    expect(w.classList.contains("sonar-catch-widget--ready")).toBe(true);
    expect(w.classList.contains("sonar-catch-widget--review")).toBe(false);
    expect(w.classList.contains("sonar-catch-widget--muted")).toBe(false);
    expect(w.querySelector("#sonar-catch-send-button")).not.toBeNull();
    expect(w.querySelector(".sonar-catch-widget__note")).toBeNull();
  });

  it("'detected-low-confidence': amber --review, the review note ABOVE a still-present Send button", () => {
    renderWidget({
      kind: "detected-low-confidence",
      posting: { ...basePosting, detection: { adapterId: "cibc", adapterLabel: "CIBC", method: "structural", confidence: "low" } },
    });
    const w = widget();
    expect(w.classList.contains("sonar-catch-widget--review")).toBe(true);
    expect(w.classList.contains("sonar-catch-widget--ready")).toBe(false);
    expect(w.classList.contains("sonar-catch-widget--muted")).toBe(false);

    const note = w.querySelector(".sonar-catch-widget__note");
    expect(note?.textContent).toBe("Detected via fallback — review before sending");
    const button = w.querySelector("#sonar-catch-send-button");
    expect(button).not.toBeNull();
    // note precedes the button in DOM order
    expect(note!.compareDocumentPosition(button!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("hard fail 'not-found': muted, an explanatory line, and NO Send button", () => {
    renderWidget({ kind: "not-found" });
    const w = widget();
    expect(w.classList.contains("sonar-catch-widget--muted")).toBe(true);
    expect(w.classList.contains("sonar-catch-widget--ready")).toBe(false);
    expect(w.classList.contains("sonar-catch-widget--review")).toBe(false);
    expect(w.querySelector("#sonar-catch-send-button")).toBeNull();
    expect(w.querySelector(".sonar-catch-widget__note")).toBeNull();
    expect(w.textContent).toContain("couldn't detect a job posting here");
  });

  it("all three render a different top-level class", () => {
    const classFor = (render: () => void): string => {
      document.body.replaceChildren();
      render();
      return widget().className.replace(" sonar-catch-widget--pulse", "");
    };
    const confident = classFor(() => renderWidget({ kind: "detected", posting: basePosting }));
    const low = classFor(() => renderWidget({ kind: "detected-low-confidence", posting: basePosting }));
    const fail = classFor(() => renderWidget({ kind: "not-found" }));
    expect(new Set([confident, low, fail]).size).toBe(3);
  });
});
