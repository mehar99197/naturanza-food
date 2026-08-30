import { useEffect, useRef, useState } from "react";

// Module-scoped cache survives component unmounts and re-mounts. This is the
// load-bearing detail — when a user clicks from /admin/reviews back to
// /admin/dashboard and then returns to /admin/reviews, the cached payload
// renders instantly while a fresh fetch runs in the background.
//
// The map is shared by every key regardless of payload type, so entries are
// stored as `unknown` and narrowed back to `T` at the single read below.
interface CacheEntry {
  data: unknown;
  ts: number;
}

const cache = new Map<string, CacheEntry>();
let cacheGeneration = 0;

const DEFAULT_TTL_MS = 60_000;

export interface SWRCacheOptions {
  /** Milliseconds before a cached entry is considered stale. */
  ttl?: number;
  /** Set false to hold the fetch back (e.g. until auth resolves). */
  enabled?: boolean;
}

export interface SWRCacheResult<T, E = unknown> {
  data: T | null;
  loading: boolean;
  revalidating: boolean;
  error: E | null;
  /** Force a fetch, resolving to the payload or null if the fetch failed. */
  refresh: () => Promise<T | null>;
}

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
 * The hook stays decoupled from any API client: the caller supplies `fetcher`,
 * which fixes `T` by inference. `E` types the rejection value and defaults to
 * `unknown`; callers that know their client's error shape can name it
 * explicitly (e.g. `useSWRCache<Review[], ApiError>(...)`).
 *
 * @param key Unique identifier (e.g. 'admin:reviews').
 */
export function useSWRCache<T, E = unknown>(
  key: string,
  fetcher: () => Promise<T>,
  opts: SWRCacheOptions = {},
): SWRCacheResult<T, E> {
  const { ttl = DEFAULT_TTL_MS, enabled = true } = opts;
  const cached = cache.get(key);

  const [data, setData] = useState<T | null>((cached?.data ?? null) as T | null);
  const [loading, setLoading] = useState(!cached);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<E | null>(null);

  // Capture latest fetcher in a ref so the effect dependency stays stable —
  // callers commonly pass an inline arrow that would otherwise re-fire the
  // effect on every render and undo the cache benefit. The ref update must
  // happen inside a layout effect (not during render) to satisfy React 19.
  const fetcherRef = useRef(fetcher);
  const requestGenerationRef = useRef(0);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const runFetch = async (): Promise<T | null> => {
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
      // A caught value is `unknown`; `E` is the caller's declared error shape.
      setError(err as E);
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

  const refresh = async (): Promise<T | null> => {
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
export function invalidateSWRKey(key: string): void {
  cache.delete(key);
}

// Wipe everything — useful on admin logout to avoid leaking cached data
// to the next user on a shared machine.
export function clearSWRCache(): void {
  cache.clear();
  cacheGeneration += 1;
}
