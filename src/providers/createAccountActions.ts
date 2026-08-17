/**
 * Password recovery and profile editing, split out of `createAuthActions` for
 * size. Semantics are unchanged from `frontend/src/context/AuthContext.jsx`.
 *
 * These are plain closures rebuilt on every render, exactly as the source had
 * them, and `updateProfile` is why: it closes over `user`, and a `useCallback`
 * whose dependency list forgot that would merge an update into a stale user and
 * write the result to localStorage.
 */

import type { Dispatch, SetStateAction } from "react";

import { userAPI } from "@/lib/api/auth";

import { apiErrorText } from "./apiErrors";
import {
  normalizeUserObject,
  resolveUserFromPayload,
  type AuthActionResult,
  type AuthResponseBody,
  type AuthUser,
  type ProfileUpdates,
} from "./authHelpers";

export interface AccountActionsDeps {
  /** Current user — `updateProfile` merges its response onto this. */
  user: AuthUser | null;
  setError: Dispatch<SetStateAction<string | null>>;
  /** Writes the user to state and localStorage; returns what it stored. */
  applyUserState: (nextUser: unknown) => AuthUser | null;
  refreshProfile: () => Promise<AuthUser | null>;
}

export interface AccountActions {
  forgotPassword: (email: string) => Promise<AuthActionResult>;
  resetPassword: (
    token: string,
    newPassword: string,
  ) => Promise<AuthActionResult>;
  updateProfile: (updates: ProfileUpdates) => Promise<AuthActionResult>;
}

export const createAccountActions = ({
  user,
  setError,
  applyUserState,
  refreshProfile,
}: AccountActionsDeps): AccountActions => {
  const forgotPassword = async (email: string): Promise<AuthActionResult> => {
    try {
      setError(null);
      await userAPI.forgotPassword({ email });
      return { success: true, message: "Reset link sent to your email" };
    } catch (err) {
      const message = apiErrorText(err) || "Failed to send reset link";
      setError(message);
      return { success: false, message };
    }
  };

  const resetPassword = async (
    token: string,
    newPassword: string,
  ): Promise<AuthActionResult> => {
    try {
      setError(null);
      await userAPI.resetPassword({ token, newPassword });
      return { success: true, message: "Password reset successfully" };
    } catch (err) {
      const message = apiErrorText(err) || "Password reset failed";
      setError(message);
      return { success: false, message };
    }
  };

  /**
   * Four fallbacks deep, and all four are load-bearing: the endpoint may answer
   * with the updated user, with nothing, or with something that fails
   * validation, and the last resort is the local merge so the form the visitor
   * just submitted does not visibly revert.
   */
  const updateProfile = async (
    updates: ProfileUpdates,
  ): Promise<AuthActionResult> => {
    try {
      setError(null);
      const response = await userAPI.updateProfile<AuthResponseBody>(updates);
      let updatedUser = normalizeUserObject(resolveUserFromPayload(response));

      if (!updatedUser) {
        updatedUser = await refreshProfile();
      }

      if (!updatedUser) {
        const merged = { ...(user || {}), ...updates };
        updatedUser = normalizeUserObject(merged) || (merged as AuthUser);
      }

      const mergedUser =
        normalizeUserObject({ ...(user || {}), ...updatedUser }) || updatedUser;
      applyUserState(mergedUser);

      return {
        success: true,
        message: response.message || "Profile updated successfully",
        user: mergedUser,
      };
    } catch (err) {
      const message = apiErrorText(err) || "Failed to update profile";
      setError(message);
      return { success: false, message };
    }
  };

  return { forgotPassword, resetPassword, updateProfile };
};
