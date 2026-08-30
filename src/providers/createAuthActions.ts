/**
 * The session actions AuthProvider publishes — register, verify, login and
 * logout. Password recovery and profile editing live in `createAccountActions`.
 *
 * Split out of AuthProvider only for size; the semantics are unchanged from
 * `frontend/src/context/AuthContext.jsx`. These are plain closures rebuilt on
 * every render, exactly as the source had them, rather than memoised
 * callbacks — see the note in `createAccountActions`.
 *
 * The token itself never passes through here: `userAPI` stores it in memory and
 * fires the session-sync event, and these functions only read whether one
 * arrived.
 */

import type { Dispatch, SetStateAction } from "react";

import { userAPI } from "@/lib/api/auth";
import { clearUserAccessToken } from "@/lib/api/session";

import { apiErrorText, asText, errorData } from "./apiErrors";
import {
  resolveUserFromPayload,
  type AuthActionResult,
  type AuthResponseBody,
  type AuthUser,
  type RegisterPayload,
} from "./authHelpers";

export interface AuthActionsDeps {
  setError: Dispatch<SetStateAction<string | null>>;
  /** Writes the user to state and localStorage; returns what it stored. */
  applyUserState: (nextUser: unknown) => AuthUser | null;
  refreshProfile: () => Promise<AuthUser | null>;
}

export interface AuthActions {
  register: (userData: RegisterPayload) => Promise<AuthActionResult>;
  verifyEmail: (
    email: string,
    code: string,
    password?: string,
  ) => Promise<AuthActionResult>;
  resendVerification: (email: string) => Promise<AuthActionResult>;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<AuthActionResult>;
  loginWithGoogle: (idToken: string) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
}

/** True when the response carried a session token under either name. */
const hasSessionToken = (response: AuthResponseBody): boolean =>
  Boolean(response.accessToken || response.token);

export const createAuthActions = ({
  setError,
  applyUserState,
  refreshProfile,
}: AuthActionsDeps): AuthActions => {
  const register = async (
    userData: RegisterPayload,
  ): Promise<AuthActionResult> => {
    try {
      setError(null);
      const response = await userAPI.register<AuthResponseBody>(userData);

      // New flow: registration emails a 6-digit code instead of logging in.
      if (response.requiresVerification) {
        return {
          success: true,
          requiresVerification: true,
          email: response.email || userData.email,
        };
      }

      if (hasSessionToken(response)) {
        const profileUser = await refreshProfile();
        if (!profileUser) {
          applyUserState(
            response.user || { email: userData.email, name: userData.name },
          );
        }
        return { success: true };
      }

      const message = response.error || "Registration failed";
      setError(message);
      return { success: false, message };
    } catch (err) {
      const responseData = errorData(err);
      // Existing-but-unverified account: send them to the verification screen.
      if (asText(responseData.code) === "EMAIL_NOT_VERIFIED") {
        return {
          success: true,
          requiresVerification: true,
          email: asText(responseData.email) || userData.email,
        };
      }
      const message = apiErrorText(err) || "Registration failed";
      setError(message);
      return { success: false, message };
    }
  };

  const verifyEmail = async (
    email: string,
    code: string,
    password?: string,
  ): Promise<AuthActionResult> => {
    try {
      setError(null);
      const response = await userAPI.verifyEmail<AuthResponseBody>({
        email,
        code,
        password,
      });
      if (hasSessionToken(response)) {
        const profileUser = await refreshProfile();
        if (!profileUser) {
          applyUserState(response.user || { email });
        }
        return { success: true };
      }
      const message = response.error || "Verification failed";
      setError(message);
      return { success: false, message, code: response.code };
    } catch (err) {
      const message = apiErrorText(err) || "Verification failed";
      setError(message);
      // `code` lets the page react to PASSWORD_REQUIRED by revealing the
      // password fields instead of just showing the message as a dead end.
      return { success: false, message, code: asText(errorData(err).code) };
    }
  };

  const resendVerification = async (
    email: string,
  ): Promise<AuthActionResult> => {
    try {
      const response = await userAPI.resendVerification<AuthResponseBody>(email);
      return { success: true, message: response.message };
    } catch (err) {
      const data = errorData(err);
      // Coerced rather than read raw: the server sends a number, but a JSON
      // string would otherwise reach a caller that does arithmetic on it.
      const retryAfter = Number(data.retryAfterSeconds);
      return {
        success: false,
        message:
          apiErrorText(err) || "Could not resend the code. Please try again.",
        retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined,
      };
    }
  };

  const login = async (
    email: string,
    password: string,
    rememberMe = false,
  ): Promise<AuthActionResult> => {
    void rememberMe;

    try {
      setError(null);
      const response = await userAPI.login<AuthResponseBody>({
        email,
        password,
      });

      if (hasSessionToken(response)) {
        const role =
          response.user && typeof response.user === "object"
            ? (response.user as Record<string, unknown>).role
            : undefined;
        const loginRole = asText(role).trim().toLowerCase();

        if (loginRole === "admin") {
          const message = "Admin accounts must use the admin login page.";
          setError(message);
          return {
            success: false,
            message,
            isAdmin: true,
            redirect: "/admin/login",
          };
        }

        const profileUser = await refreshProfile();
        if (!profileUser) {
          applyUserState(response.user || { email });
        }

        return { success: true };
      }

      const message = response.error || "Login failed";
      setError(message);
      return { success: false, message };
    } catch (err) {
      const responseData = errorData(err);
      // Unverified account trying to log in — route to the verification screen.
      if (asText(responseData.code) === "EMAIL_NOT_VERIFIED") {
        return {
          success: false,
          requiresVerification: true,
          email: asText(responseData.email) || email,
          message: apiErrorText(err) || "Please verify your email first.",
        };
      }
      const message = apiErrorText(err) || "Login failed";
      const isAdmin = Boolean(responseData.isAdmin);
      setError(message);
      return {
        success: false,
        message,
        isAdmin,
        redirect: asText(responseData.redirect) || null,
      };
    }
  };

  const loginWithGoogle = async (
    idToken: string,
  ): Promise<AuthActionResult> => {
    try {
      setError(null);
      const response = await userAPI.loginWithGoogle<AuthResponseBody>(idToken);

      if (hasSessionToken(response)) {
        const profileUser = await refreshProfile();
        if (!profileUser) {
          applyUserState(resolveUserFromPayload(response));
        }
        return { success: true };
      }

      const message = response.error || "Google login failed";
      setError(message);
      return { success: false, message };
    } catch (err) {
      const message = apiErrorText(err) || "Google login failed";
      setError(message);
      return { success: false, message };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await userAPI.logout();
    } catch {
      // Local cleanup still happens if network logout fails.
    } finally {
      // Kept even though `userAPI.logout` already clears the token: the second
      // call bumps the session generation again, which is what discards a
      // token refresh that is still in flight at the moment we log out.
      clearUserAccessToken();
      applyUserState(null);
      setError(null);
    }
  };

  return {
    register,
    verifyEmail,
    resendVerification,
    login,
    loginWithGoogle,
    logout,
  };
};
