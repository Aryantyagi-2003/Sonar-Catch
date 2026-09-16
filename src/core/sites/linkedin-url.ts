// LinkedIn's split-view search results carry the open job as a query param
// (`?currentJobId=<id>`) on a `/jobs/search/...` URL loaded with tracking params attached.
// That's a bad `sourceUrl` to store: it's not stable (the same job can be reached via many
// different search queries) and it's not a URL a human would recognize the job by.
// `linkedin.com/jobs/view/<id>/` is the canonical, guest-accessible, shareable form
// (confirmed live 2026-09-16) — normalize to it whenever a job id is identifiable, which
// also gives cross-site duplicate lookups a consistent LinkedIn URL to compare against.
export function canonicalLinkedInJobUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const currentJobId = url.searchParams.get("currentJobId");
  if (currentJobId && /^\d+$/.test(currentJobId)) {
    return `https://www.linkedin.com/jobs/view/${currentJobId}/`;
  }

  const viewMatch = url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)\/?$/);
  if (viewMatch) {
    return `https://www.linkedin.com/jobs/view/${viewMatch[1]}/`;
  }

  return rawUrl;
}
