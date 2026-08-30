"use client";

/**
 * Storefront session state, ported from `frontend/src/context/AuthContext.jsx`.
 *
 * Effect timing and dependency arrays are reproduced exactly — together with
 * the bootstrap in `createAuthBootstrap`, they decide whether a returning
 * visitor stays signed in or is silently signed out on first paint.
 *
 * ONE DELIBERATE CHANGE, forced by server rendering: the source seeded state
 * with `useState(() => getCachedUserData())`, reading localStorage during the
 * initial render. There is no localStorage on the server, so the server would
 * render a logged-out tree and the browser a logged-in one, and React would
 * throw the server HTML away with a hydration mismatch. The cached user is now
 * adopted in the mount effect instead, before `bootstrapAuth` awaits anything.
 * Nothing downstream can observe the difference: `isAuthenticated` is
 * `!loading && !!user`, and `loading` stays true across that whole window, so
 * CartProvider and WishlistProvider see exactly the same transitions.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { userAPI } from "@/lib/api/auth";
import {
  AUTH_SESSION_SYNC_EVENT,
  clearUserAccessToken,
  emitAuthSessionSync,
  getUserAccessToken,
  hasUserSession,
  type AuthSessionSyncDetail,
} from "@/lib/api/session";

import { asText } from "./apiErrors";
import {
  getCachedUserData,
  normalizeUserObject,
  writeCachedUserData,
  USER_DATA_STORAGE_KEY,
  type AuthUser,
} from "./authHelpers";
import {
  createAccountActions,
  type AccountActions,
} from "./createAccountActions";
import { createAuthActions, type AuthActions } from "./createAuthActions";
import { createAuthBootstrap } from "./createAuthBootstrap";

export interface AuthContextValue extends AuthActions, AccountActions {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<AuthUser | null>;
  /** True only once the bootstrap has finished *and* a user is present. */
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Access token refresh cadence — ahead of the 15-minute token expiry. */
const TOKEN_REFRESH_INTERVAL_MS = 12 * 60 * 1000;

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bootstrapRunIdRef = useRef(0);

  const applyUserState = (nextUser: unknown): AuthUser | null => {
    const normalizedUser = normalizeUserObject(nextUser);
    setUser(normalizedUser);
    writeCachedUserData(normalizedUser);
    return normalizedUser;
  };

  const { refreshProfile, bootstrapAuth } = createAuthBootstrap({
    applyUserState,
    setLoading,
    setError,
    runIdRef: bootstrapRunIdRef,
  });

  useEffect(() => {
    // Effects run only in the browser, which is why the cached user is adopted
    // here rather than in a state initialiser.
    const cachedUser = getCachedUserData();
    if (cachedUser) {
      setUser(cachedUser);
    }

    void bootstrapAuth();

    return () => {
      bootstrapRunIdRef.current += 1;
    };
    // Mount-only, as in the source. The closures captured here touch nothing
    // but the (stable) state setters and the run-id ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleSessionSync = (event: Event) => {
      const detail = (event as CustomEvent<AuthSessionSyncDetail>).detail;
      const source = asText(detail?.source).toLowerCase();
      if (source.startsWith("admin-")) {
        return;
      }

      if (source === "user-logout" || source === "user-token-refresh-failed") {
        clearUserAccessToken();
        applyUserState(null);
        setLoading(false);
        return;
      }

      if (source === "user-token-refresh" || source === "user-refresh") {
        return;
      }

      void refreshProfile();
    };

    // Cross-tab: another tab writing `userData` is how a login or logout there
    // reaches this one.
    const handleStorageSync = (event: StorageEvent) => {
      if (event.key !== USER_DATA_STORAGE_KEY) {
        return;
      }
      if (!event.newValue) {
        clearUserAccessToken();
        applyUserState(null);
        setLoading(false);
        return;
      }
      try {
        const nextUser = normalizeUserObject(JSON.parse(event.newValue));
        if (nextUser) {
          applyUserState(nextUser);
        }
      } catch {
        clearUserAccessToken();
        applyUserState(null);
      }
    };

    window.addEventListener(AUTH_SESSION_SYNC_EVENT, handleSessionSync);
    window.addEventListener("storage", handleStorageSync);
    return () => {
      window.removeEventListener(AUTH_SESSION_SYNC_EVENT, handleSessionSync);
      window.removeEventListener("storage", handleStorageSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic token refresh - runs every 12 minutes to keep session alive
  useEffect(() => {
    if (typeof window === "undefined" || !user) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      if (!getUserAccessToken() || !hasUserSession()) {
        window.clearInterval(intervalId);
        return;
      }

      try {
        await userAPI.refreshToken();
      } catch {
        clearUserAccessToken();
        emitAuthSessionSync("user-token-refresh-failed");
      }
    }, TOKEN_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user]);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    ...createAuthActions({ setError, applyUserState, refreshProfile }),
    ...createAccountActions({ user, setError, applyUserState, refreshProfile }),
    refreshProfile,
    isAuthenticated: !loading && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
