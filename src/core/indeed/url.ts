// Indeed's split-view pages (search results, and the homepage feed at `/?r=us`) show the
// open job in a side pane while the address bar stays on the list page — at most a
// `vjk=<id>` param identifies the job, and on the homepage feed even that can be missing.
// Storing that raw URL as `sourceUrl` is actively harmful: Sonar's duplicate lookup tries
// an exact `sourceUrl` match first, so every job opened from the same feed URL "matched"
// whichever job was first logged from it (real bug: "Already logged" for a posting that
// was never sent). Normalize to the canonical `/viewjob?jk=<id>` form when a job key is
// identifiable, and return null otherwise so the lookup falls back to company+role.
const JOB_KEY_PATTERN = /^[0-9a-f]{16}$/i;

export function canonicalIndeedJobUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // `jk` is the job's own page (/viewjob?jk=…); `vjk` is the job open in a split-view pane.
  const jobKey = url.searchParams.get("jk") ?? url.searchParams.get("vjk");
  if (jobKey && JOB_KEY_PATTERN.test(jobKey)) {
    return `https://${url.hostname}/viewjob?jk=${jobKey.toLowerCase()}`;
  }

  return null;
}
