/**
 * Base URL and timeout resolution for the API client.
 *
 * Ported from `frontend/src/services/api.js` (`resolveApiBaseUrl`), with Vite's
 * `import.meta.env.VITE_*` swapped for the Next equivalents. The algorithm is
 * deliberately unchanged: an explicit override wins, a production browser build
 * talks to a same-origin `/api`, a dev browser build talks to the Express port
 * directly, and anything evaluated outside a browser falls back to localhost.
 *
 * Same-origin `/api` is correct here for a second reason the Vite app did not
 * have: Next runs *inside* the Express process (see backend/nextServer.js), so
 * pages and the API are served from one origin on one port.
 *
 * `process.env.NEXT_PUBLIC_*` is written as a full literal property access on
 * purpose — Next inlines those at build time by textual substitution, so
 * destructuring or a dynamic lookup would silently yield undefined.
 */

const trimmed = (value: string | undefined): string => String(value ?? "").trim();

/**
 * Resolves the base URL from scratch. Exported for tests; normal callers want
 * {@link getApiBaseUrl}, which caches.
 */
export const resolveApiBaseUrl = (): string => {
  const configuredApiUrl = trimmed(process.env.NEXT_PUBLIC_API_URL);
  if (configuredApiUrl) {
    return configuredApiUrl;
  }

  if (typeof window !== "undefined") {
    const protocol = String(window.location.protocol || "http:");
    const hostname = String(window.location.hostname || "localhost");
    if (process.env.NODE_ENV === "production") {
      return "/api";
    }

    const apiPort = Number.parseInt(
      trimmed(process.env.NEXT_PUBLIC_API_PORT) || "5000",
      10,
    );
    const safePort = Number.isFinite(apiPort) && apiPort > 0 ? apiPort : 5000;

    return `${protocol}//${hostname}:${safePort}/api`;
  }

  return "http://localhost:5000/api";
};

let cachedBaseUrl: string | null = null;

/**
 * The base URL every request is joined onto.
 *
 * The Vite build resolved this once at module load. Here it is resolved lazily
 * and cached only once a `window` exists, because a client module can also be
 * evaluated during server rendering — caching the server-side fallback would
 * leave the browser talking to localhost. The value the browser computes is
 * identical to what the original produced.
 */
export const getApiBaseUrl = (): string => {
  if (cachedBaseUrl !== null) {
    return cachedBaseUrl;
  }
  const resolved = resolveApiBaseUrl();
  if (typeof window !== "undefined") {
    cachedBaseUrl = resolved;
  }
  return resolved;
};

/** Matches the `timeout: 10000` on both axios instances in the source. */
export const DEFAULT_TIMEOUT_MS = 10_000;

const parsedInvoiceTimeout = Number.parseInt(
  trimmed(process.env.NEXT_PUBLIC_INVOICE_DOWNLOAD_TIMEOUT_MS) || "120000",
  10,
);

/**
 * Invoice PDFs are generated on demand and routinely outrun the 10s default.
 * Floor of 10s so a misconfigured env cannot make the download unusable.
 */
export const INVOICE_DOWNLOAD_TIMEOUT_MS = Math.max(
  parsedInvoiceTimeout || 120_000,
  10_000,
);

/**
 * Sent by axios on every request via `defaults.headers.common`. Reproduced so
 * content negotiation on the Express side sees the same request it always has.
 */
export const DEFAULT_ACCEPT_HEADER = "application/json, text/plain, */*";

/** The only CSRF header name `backend/middleware/csrf.js` reads. */
export const CSRF_HEADER_NAME = "x-csrf-token";

/** Opt-out header that suppresses the 401/403 refresh-and-retry interceptor. */
export const SKIP_AUTH_REFRESH_HEADER = "X-Skip-Auth-Refresh";

/** Window event the auth context listens on to re-sync across tabs. */
export const AUTH_SESSION_SYNC_EVENT = "naturanza:auth-session-sync";
