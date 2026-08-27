import type { ExtractedJobPosting } from "@/core/types";
import type { ExistingApplicationMatch } from "@/core/sonar-client";

const WIDGET_ID = "sonar-catch-widget";

export type WidgetState =
  | { kind: "hidden" }
  | { kind: "detected"; posting: ExtractedJobPosting }
  | { kind: "sending" }
  | { kind: "sent"; applicationId: string }
  | { kind: "already-logged"; match: ExistingApplicationMatch; existingUrl: string }
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

// Builds every state's contents as real DOM nodes (createElement + textContent) rather
// than HTML strings — not just to avoid escaping mistakes, but because static analyzers
// (notably AMO's, which submitting to Mozilla runs) flag any dynamic innerHTML assignment
// on sight, escaped or not, since they can't verify escaping was actually applied.
function textSpan(text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

export function renderWidget(state: WidgetState): void {
  const widget = ensureWidget();

  if (state.kind === "hidden") {
    widget.style.display = "none";
    widget.replaceChildren();
    return;
  }

  widget.style.display = "flex";

  switch (state.kind) {
    case "not-found":
      widget.className = "sonar-catch-widget sonar-catch-widget--muted";
      widget.replaceChildren(textSpan("Sonar Catch: couldn't detect a job posting here"));
      break;

    case "detected": {
      widget.className = "sonar-catch-widget sonar-catch-widget--ready sonar-catch-widget--pulse";

      const button = document.createElement("button");
      button.type = "button";
      button.id = "sonar-catch-send-button";
      button.textContent = "Send to Sonar";
      button.addEventListener("click", () => onSendClick?.());

      const title = document.createElement("span");
      title.className = "sonar-catch-widget__title";
      title.title = state.posting.title;
      title.textContent = truncate(state.posting.title, 40);

      widget.replaceChildren(button, title);
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
    }

    case "sending":
      widget.className = "sonar-catch-widget sonar-catch-widget--busy";
      widget.replaceChildren(textSpan("Sending to Sonar…"));
      break;

    case "sent":
      widget.className = "sonar-catch-widget sonar-catch-widget--success";
      widget.replaceChildren(textSpan("Saved to Sonar ✓"));
      break;

    case "already-logged": {
      widget.className = "sonar-catch-widget sonar-catch-widget--muted";

      const label = textSpan(`Already logged (${state.match.stage.toLowerCase()}) — `);

      const link = document.createElement("a");
      link.href = state.existingUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "view in Sonar";

      widget.replaceChildren(label, link);
      break;
    }

    case "error":
      widget.className = "sonar-catch-widget sonar-catch-widget--error";
      widget.replaceChildren(textSpan(state.message));
      break;
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
