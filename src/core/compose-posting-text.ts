import type { ExtractedJobPosting } from "@/core/types";

// Sonar's extraction prompt expects "the full job posting text" the way a human would
// paste it — title, company, location, and salary line included above the description,
// not just the description body alone. Reassembling that shape here (rather than sending
// descriptionText in isolation) gives Sonar's Gemini classifier the same signal a manual
// paste would carry.
export function composePostingText(posting: ExtractedJobPosting): string {
  const lines = [
    posting.title,
    posting.company,
    posting.location ?? undefined,
    posting.salary?.raw ?? undefined,
    "",
    posting.descriptionText,
  ].filter((line): line is string => line !== undefined);

  return lines.join("\n");
}
