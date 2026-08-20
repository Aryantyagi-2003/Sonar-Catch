import type { ExtractedJobPosting } from "@/core/types";

const WIDGET_ID = "sonar-catch-widget";

export type WidgetState =
  | { kind: "hidden" }
  | { kind: "detected"; posting: ExtractedJobPosting }
  | { kind: "sending" }
  | { kind: "sent"; applicationId: string }
  | { kind: "error"; message: string }
  | { kind: "not-found" };

let onSendClick: (() => void) | null = null;

export function setSendHandler(handler: () => void): void {
  onSendClick = handler;
}

function ensureWidget(): HTMLElement {
  let widget = document.getElementById(WIDGET_ID);
  if (widget) return widget;

  widget = document.createElement("div");
  widget.id = WIDGET_ID;
  document.body.appendChild(widget);
  return widget;
}

export function renderWidget(state: WidgetState): void {
  const widget = ensureWidget();

  if (state.kind === "hidden") {
    widget.style.display = "none";
    widget.innerHTML = "";
    return;
  }

  widget.style.display = "flex";

  switch (state.kind) {
    case "not-found":
      widget.className = "sonar-catch-widget sonar-catch-widget--muted";
      widget.innerHTML = `<span>Sonar Catch: couldn't detect a job posting here</span>`;
      break;

    case "detected":
      widget.className = "sonar-catch-widget sonar-catch-widget--ready sonar-catch-widget--pulse";
      widget.innerHTML = `
        <button type="button" id="sonar-catch-send-button">Send to Sonar</button>
        <span class="sonar-catch-widget__title" title="${escapeHtml(state.posting.title)}">${escapeHtml(truncate(state.posting.title, 40))}</span>
      `;
      widget.querySelector("#sonar-catch-send-button")?.addEventListener("click", () => onSendClick?.());
      // Restart the pulse animation on every render so a newly-detected posting always
      // visibly flashes, even if the previous state was also "detected" (guards against
      // rapid clicking landing on two different postings whose UI would otherwise look
      // static in between).
      requestAnimationFrame(() => {
        widget.classList.remove("sonar-catch-widget--pulse");
        void widget.offsetWidth;
        widget.classList.add("sonar-catch-widget--pulse");
      });
      break;

    case "sending":
      widget.className = "sonar-catch-widget sonar-catch-widget--busy";
      widget.innerHTML = `<span>Sending to Sonar…</span>`;
      break;

    case "sent":
      widget.className = "sonar-catch-widget sonar-catch-widget--success";
      widget.innerHTML = `<span>Saved to Sonar ✓</span>`;
      break;

    case "error":
      widget.className = "sonar-catch-widget sonar-catch-widget--error";
      widget.innerHTML = `<span>${escapeHtml(state.message)}</span>`;
      break;
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
