import { useEffect, useRef, useState } from "react";

// Module-scoped cache survives component unmounts and re-mounts. This is the
// load-bearing detail — when a user clicks from /admin/reviews back to
// /admin/dashboard and then returns to /admin/reviews, the cached payload
// renders instantly while a fresh fetch runs in the background.
//
// Cache shape:  Map<string, { data: unknown, ts: number }>
const cache = new Map();
let cacheGeneration = 0;

const DEFAULT_TTL_MS = 60_000;

/**
 * Stale-while-revalidate fetch hook for admin pages.
 *
 * Behavior:
 *   - First mount, no cache : `loading=true`, fetcher runs, UI shows spinner.
 *   - Re-mount with cache   : `loading=false`, data returns synchronously,
 *                             background fetch refreshes the entry.
 *   - Cache older than ttl  : data returns synchronously, but `revalidating=true`
 *                             so callers can show a subtle indicator.
 *
 * @param {string} key       Unique identifier (e.g. 'admin:reviews')
 * @param {() => Promise<T>} fetcher
 * @param {{ ttl?: number, enabled?: boolean }} opts
 * @returns {{ data, loading, revalidating, error, refresh }}
 */
export function useSWRCache(key, fetcher, opts = {}) {
  const { ttl = DEFAULT_TTL_MS, enabled = true } = opts;
  const cached = cache.get(key);

  const [data, setData] = useState(cached?.data ?? null);
  const [loading, setLoading] = useState(!cached);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState(null);

  // Capture latest fetcher in a ref so the effect dependency stays stable —
  // callers commonly pass an inline arrow that would otherwise re-fire the
  // effect on every render and undo the cache benefit. The ref update must
  // happen inside a layout effect (not during render) to satisfy React 19.
  const fetcherRef = useRef(fetcher);
  const requestGenerationRef = useRef(0);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const runFetch = async () => {
    const requestGeneration = ++requestGenerationRef.current;
    const currentCacheGeneration = cacheGeneration;
    try {
      const result = await fetcherRef.current();
      if (
        requestGeneration !== requestGenerationRef.current ||
        currentCacheGeneration !== cacheGeneration
      ) {
        return result;
      }
      cache.set(key, { data: result, ts: Date.now() });
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      if (requestGeneration !== requestGenerationRef.current) {
        return null;
      }
      setError(err);
      throw err;
    }
  };

  useEffect(() => {
    if (!enabled) return;

    const entry = cache.get(key);
    const isFresh = entry && Date.now() - entry.ts < ttl;

    if (!entry) {
      // First-ever load for this key → block UI on the initial fetch.
      setLoading(true);
      runFetch()
        .finally(() => setLoading(false))
        .catch(() => {});
    } else if (!isFresh) {
      // Have data but stale → render cached, fetch in background.
      setRevalidating(true);
      runFetch()
        .finally(() => setRevalidating(false))
        .catch(() => {});
    }
    // Fresh cache: no fetch needed, data already returned synchronously above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, ttl]);

  const refresh = async () => {
    setRevalidating(true);
    try {
      return await runFetch();
    } catch {
      return null;
    } finally {
      setRevalidating(false);
    }
  };

  return { data, loading, revalidating, error, refresh };
}

// Explicitly evict a key — call after mutations so the next visit refetches.
export function invalidateSWRKey(key) {
  cache.delete(key);
}

// Wipe everything — useful on admin logout to avoid leaking cached data
// to the next user on a shared machine.
export function clearSWRCache() {
  cache.clear();
  cacheGeneration += 1;
}
