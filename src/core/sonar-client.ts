// Talks to Sonar's existing /api/ingest and /api/ingest/confirm endpoints — no parallel
// extraction path, this only moves text and relays Sonar's own classification back.
// Pure logic (fetch is injected), so it's testable without a real browser or network.

export interface JobPostingExtraction {
  company: string;
  role: string;
  industry: string;
  seniority: string;
  payRange: { min: number; max: number; currency: string } | null;
  requiredSkills: string[];
  fitVerdict: string;
  fitRationale: string;
}

export type IngestResult =
  | { ok: true; pendingToken: string; extraction: JobPostingExtraction }
  | { ok: false; status: number; error: string };

export type ConfirmResult =
  | { ok: true; applicationId: string }
  | { ok: false; status: number; error: string };

function normalizeBaseUrl(sonarUrl: string): string {
  return sonarUrl.replace(/\/+$/, "");
}

export async function submitJobPosting(
  sonarUrl: string,
  apiToken: string,
  payload: { jobPostingText: string; sourceUrl: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<IngestResult> {
  try {
    const response = await fetchImpl(`${normalizeBaseUrl(sonarUrl)}/api/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return { ok: false, status: response.status, error: body?.error ?? `Request failed (${response.status}).` };
    }
    if (!body?.pendingToken || !body?.extraction) {
      return { ok: false, status: response.status, error: "Sonar returned an unexpected response." };
    }

    return { ok: true, pendingToken: body.pendingToken, extraction: body.extraction };
  } catch {
    return { ok: false, status: 0, error: "Couldn't reach Sonar — check the instance URL and your connection." };
  }
}

export async function confirmJobPosting(
  sonarUrl: string,
  apiToken: string,
  pendingToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConfirmResult> {
  try {
    const response = await fetchImpl(`${normalizeBaseUrl(sonarUrl)}/api/ingest/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ pendingToken }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return { ok: false, status: response.status, error: body?.error ?? `Request failed (${response.status}).` };
    }
    if (!body?.applicationId) {
      return { ok: false, status: response.status, error: "Sonar returned an unexpected response." };
    }

    return { ok: true, applicationId: body.applicationId };
  } catch {
    return { ok: false, status: 0, error: "Couldn't reach Sonar — check the instance URL and your connection." };
  }
}
