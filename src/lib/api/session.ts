/**
 * In-memory session state.
 *
 * Access tokens are memory-only by design: the refresh token stays in an
 * HttpOnly cookie, so XSS cannot read a reusable browser-storage token. Nothing
 * in this module may be moved to `localStorage`/`sessionStorage`.
 */

import { AUTH_SESSION_SYNC_EVENT } from "./config";

/** Detail carried on the `naturanza:auth-session-sync` window event. */
export interface AuthSessionSyncDetail {
  /**
   * Why the session changed. The values the client itself emits are
   * `user-login`, `user-register`, `user-verify-email`, `user-google-login`,
   * `user-token-refresh`, `user-token-refresh-failed`, `user-logout`,
   * `admin-logout` and `admin-token-invalid`.
   */
  source: string;
  timestamp: number;
}

let userAccessToken: string | null = null;
let adminAccessToken: string | null = null;
let userSessionActive = false;

/**
 * Bumped on every user logout/clear. An in-flight refresh compares the
 * generation it started under against the current one and discards its result
 * if they differ, so a refresh that lands after a logout cannot resurrect the
 * session.
 */
let userAuthGeneration = 0;

export const setUserAccessToken = (token: string | null | undefined): void => {
  userAccessToken = token ? String(token) : null;
  userSessionActive = Boolean(userAccessToken);
};

export const getUserAccessToken = (): string | null => userAccessToken;

export const hasUserSession = (): boolean => userSessionActive;

export const clearUserAccessToken = (): void => {
  userAuthGeneration += 1;
  userAccessToken = null;
  userSessionActive = false;
};

export const setAdminAccessToken = (token: string | null | undefined): void => {
  adminAccessToken = token ? String(token) : null;
};

export const getAdminAccessToken = (): string | null => adminAccessToken;

export const clearAdminAccessToken = (): void => {
  adminAccessToken = null;
};

export const getUserAuthGeneration = (): number => userAuthGeneration;

/**
 * Tells the rest of the app — and any other tab listening — that the session
 * changed. A no-op outside the browser so a client module can still be
 * evaluated during server rendering.
 */
export const emitAuthSessionSync = (source: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AuthSessionSyncDetail>(AUTH_SESSION_SYNC_EVENT, {
      detail: {
        source,
        timestamp: Date.now(),
      },
    }),
  );
};

export { AUTH_SESSION_SYNC_EVENT };
