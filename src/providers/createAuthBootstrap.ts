/**
 * Session bootstrap and profile refresh, split out of AuthProvider for size.
 *
 * `bootstrapAuth` is the single most delicate flow in the port, because getting
 * it wrong signs a returning customer out. The order is exactly the source's:
 *
 *   1. no token in memory -> try the HttpOnly refresh cookie; if that fails the
 *      visitor is simply logged out, and that is not an error worth showing;
 *   2. fetch the profile;
 *   3. a 401/403 -> refresh once and fetch again, because a page load with an
 *      expired access token is the *normal* returning-visitor path;
 *   4. still 401/403 -> clear the session. Any other failure (a 500, a dropped
 *      connection) deliberately leaves the cached user in place rather than
 *      logging someone out because the network blinked.
 *
 * `runIdRef` guards every write: the provider bumps it on unmount, so a slow
 * response cannot resurrect a session after the tree is gone.
 */

import type { Dispatch, SetStateAction } from "react";

import { userAPI } from "@/lib/api/auth";
import {
  clearUserAccessToken,
  getUserAccessToken,
  hasUserSession,
} from "@/lib/api/session";

import { errorStatus } from "./apiErrors";
import {
  isAuthFailureStatus,
  resolveUserFromPayload,
  type AuthUser,
} from "./authHelpers";

export interface AuthBootstrapDeps {
  /** Writes the user to state and localStorage; returns what it stored. */
  applyUserState: (nextUser: unknown) => AuthUser | null;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  /** Incremented per run and on unmount; a stale run abandons its writes. */
  runIdRef: { current: number };
}

export interface AuthBootstrap {
  refreshProfile: () => Promise<AuthUser | null>;
  bootstrapAuth: () => Promise<void>;
}

/** One profile attempt: the payload, or the HTTP status that refused it. */
interface ProfileAttempt {
  user: unknown;
  status: number | null;
}

export const createAuthBootstrap = ({
  applyUserState,
  setLoading,
  setError,
  runIdRef,
}: AuthBootstrapDeps): AuthBootstrap => {
  const refreshProfile = async (): Promise<AuthUser | null> => {
    if (!getUserAccessToken() || !hasUserSession()) {
      clearUserAccessToken();
      applyUserState(null);
      return null;
    }

    try {
      const profileResponse = await userAPI.getProfile();
      return applyUserState(resolveUserFromPayload(profileResponse));
    } catch (err) {
      if (isAuthFailureStatus(errorStatus(err))) {
        clearUserAccessToken();
        applyUserState(null);
      }
      return null;
    }
  };

  const fetchProfileIfAvailable = async (): Promise<ProfileAttempt> => {
    try {
      const profileResponse = await userAPI.getProfile();
      return { user: resolveUserFromPayload(profileResponse), status: null };
    } catch (err) {
      return { user: null, status: errorStatus(err) };
    }
  };

  const bootstrapAuth = async (): Promise<void> => {
    const runId = ++runIdRef.current;

    try {
      setLoading(true);
      if (!getUserAccessToken() || !hasUserSession()) {
        try {
          await userAPI.refreshToken();
        } catch {
          clearUserAccessToken();
          applyUserState(null);
          setError(null);
          return;
        }
      }

      const initialProfile = await fetchProfileIfAvailable();
      if (runIdRef.current !== runId) {
        return;
      }

      if (initialProfile.user) {
        const resolvedUser = applyUserState(initialProfile.user);
        if (!resolvedUser) {
          throw new Error("Invalid profile response");
        }
        setError(null);
        return;
      }

      // `Number(null)` is 0, which is not an auth failure — same outcome as the
      // source's direct comparison against a null status.
      if (!isAuthFailureStatus(Number(initialProfile.status))) {
        throw new Error("Profile request failed");
      }

      await userAPI.refreshToken();
      if (runIdRef.current !== runId) {
        return;
      }

      const refreshedProfile = await fetchProfileIfAvailable();
      if (runIdRef.current !== runId) {
        return;
      }

      if (refreshedProfile.user) {
        const resolvedUser = applyUserState(refreshedProfile.user);
        if (!resolvedUser) {
          throw new Error("Invalid profile response");
        }
        setError(null);
        return;
      }

      if (isAuthFailureStatus(Number(refreshedProfile.status))) {
        clearUserAccessToken();
        applyUserState(null);
      }
    } catch (err) {
      if (runIdRef.current !== runId) {
        return;
      }

      if (isAuthFailureStatus(errorStatus(err))) {
        clearUserAccessToken();
        applyUserState(null);
      }
    } finally {
      if (runIdRef.current === runId) {
        setLoading(false);
      }
    }
  };

  return { refreshProfile, bootstrapAuth };
};
