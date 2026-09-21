import type { SiteAdapter } from "@/core/sites/registry";
import type { ExtractedJobPosting } from "@/core/types";

// Backs `SiteAdapter.remoteSource`: reads the open posting from a server-rendered copy of
// it rather than from the live SPA. Results (including failures) are cached per source URL
// for the life of the page — a LinkedIn tab fires DOM mutations constantly, and we want one
// request per job viewed, not one per mutation.

const cache = new Map<string, Promise<ExtractedJobPosting | null>>();

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "text">>;

async function fetchAndExtract(
  adapter: SiteAdapter,
  remoteUrl: string,
  sourceUrl: string,
  doFetch: FetchLike,
): Promise<ExtractedJobPosting | null> {
  try {
    // `omit`: we want the public, logged-out rendering — the same page a shared link opens.
    // It's also what has stable, verified markup; the logged-in one is the thing we're
    // avoiding.
    const response = await doFetch(remoteUrl, { credentials: "omit" });
    if (!response.ok) return null;

    // DOMParser builds an inert document: no scripts run, nothing loads.
    const doc = new DOMParser().parseFromString(await response.text(), "text/html");
    const result = adapter.extract(doc, sourceUrl);

    // Only trust a real match. A low-confidence structural guess over a page we fetched
    // blind (login wall, error page, a redesign) is worse than what the live page gives.
    if (result.status === "ok" && result.posting.detection?.confidence === "high") return result.posting;
    return null;
  } catch {
    return null;
  }
}

/** Null means "no remote source applies here, or it didn't yield a confident posting" —
 *  the caller should fall back to reading the live page. */
export function extractFromRemote(
  adapter: SiteAdapter,
  pageUrl: URL,
  doFetch: FetchLike = (input, init) => fetch(input, init),
): Promise<ExtractedJobPosting | null> {
  const remoteUrl = adapter.remoteSource?.(pageUrl);
  if (!remoteUrl) return Promise.resolve(null);

  let pending = cache.get(remoteUrl);
  if (!pending) {
    pending = fetchAndExtract(adapter, remoteUrl, pageUrl.href, doFetch);
    cache.set(remoteUrl, pending);
  }
  return pending;
}

/** Test seam. */
export function clearRemoteCache(): void {
  cache.clear();
}
