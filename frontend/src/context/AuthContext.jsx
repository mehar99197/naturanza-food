import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  AUTH_SESSION_SYNC_EVENT,
  clearUserAccessToken,
  userAPI,
} from "@/services/api";

const AuthContext = createContext(null);

const resolveApiBaseUrl = () => {
  const configuredApiUrl = String(import.meta.env.VITE_API_URL || "").trim();
  if (configuredApiUrl) {
    return configuredApiUrl;
  }

  if (typeof window !== "undefined") {
    const protocol = String(window.location.protocol || "http:");
    const hostname = String(window.location.hostname || "localhost");
    const apiPort = Number.parseInt(
      String(import.meta.env.VITE_API_PORT || "5000"),
      10,
    );
    const safePort = Number.isFinite(apiPort) && apiPort > 0 ? apiPort : 5000;

    return `${protocol}//${hostname}:${safePort}/api`;
  }

  return "http://localhost:5000/api";
};

const API_BASE_URL = resolveApiBaseUrl();
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const resolveUserFromPayload = (payload) =>
  payload?.user || payload?.profile || payload;

const normalizeProfileImageUrl = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== "string") {
    return null;
  }

  const normalizedPath = imageUrl.trim().replace(/\\/g, "/");

  if (
    normalizedPath.startsWith("data:") ||
    normalizedPath.startsWith("blob:") ||
    /^https?:\/\//i.test(normalizedPath)
  ) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("/")) {
    return `${API_ORIGIN}${normalizedPath}`;
  }

  if (/^(images|uploads)\//i.test(normalizedPath)) {
    return `${API_ORIGIN}/${normalizedPath}`;
  }

  return normalizedPath;
};

const isValidUserObject = (candidate) => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return false;
  }

  return (
    Object.prototype.hasOwnProperty.call(candidate, "id") ||
    typeof candidate.email === "string" ||
    typeof candidate.name === "string"
  );
};

const normalizeUserObject = (candidate) => {
  if (!isValidUserObject(candidate)) {
    return null;
  }

  const normalized = { ...candidate };
  const profileImage = normalizeProfileImageUrl(
    normalized.profile_image ||
      normalized.profileImage ||
      normalized.avatar ||
      null,
  );

  if (Object.prototype.hasOwnProperty.call(normalized, "password_set_by_user")) {
    normalized.password_set_by_user = Boolean(
      Number(normalized.password_set_by_user),
    );
  }

  if (normalized.signup_provider) {
    normalized.signup_provider = String(normalized.signup_provider)
      .trim()
      .toLowerCase();
  }

  if (profileImage) {
    normalized.profile_image = profileImage;
    normalized.profileImage = profileImage;
    normalized.avatar = normalized.avatar || profileImage;
  }

  return normalized;
};

const safeLocalStorage = {
  getItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  },
  removeItem(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};

const getCachedUserData = () => {
  const raw = safeLocalStorage.getItem("userData");
  if (!raw) {
    return null;
  }

  try {
    return normalizeUserObject(JSON.parse(raw));
  } catch (error) {
    safeLocalStorage.removeItem("userData");
    return null;
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getCachedUserData());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const bootstrapRunIdRef = useRef(0);

  const isAuthFailureStatus = (statusCode) =>
    statusCode === 401 || statusCode === 403;

  const applyUserState = (nextUser) => {
    const normalizedUser = normalizeUserObject(nextUser);
    setUser(normalizedUser);

    if (normalizedUser) {
      safeLocalStorage.setItem("userData", JSON.stringify(normalizedUser));
      if (normalizedUser.profile_image) {
        safeLocalStorage.setItem("profileImage", normalizedUser.profile_image);
      } else {
        safeLocalStorage.removeItem("profileImage");
      }
    } else {
      safeLocalStorage.removeItem("userData");
      safeLocalStorage.removeItem("profileImage");
    }

    return normalizedUser;
  };

  const refreshProfile = async () => {
    try {
      const profileResponse = await userAPI.getProfile();
      return applyUserState(resolveUserFromPayload(profileResponse));
    } catch (err) {
      const statusCode = Number(err?.response?.status || 0);
      if (isAuthFailureStatus(statusCode)) {
        clearUserAccessToken();
        applyUserState(null);
      }
      return null;
    }
  };

  const bootstrapAuth = async () => {
    const runId = ++bootstrapRunIdRef.current;

    try {
      setLoading(true);
      await userAPI.refreshToken();
      if (bootstrapRunIdRef.current !== runId) {
        return;
      }

      const profile = await userAPI.getProfile();
      if (bootstrapRunIdRef.current !== runId) {
        return;
      }

      const resolvedUser = applyUserState(resolveUserFromPayload(profile));
      if (!resolvedUser) {
        throw new Error("Invalid profile response");
      }
      setError(null);
    } catch (err) {
      if (bootstrapRunIdRef.current !== runId) {
        return;
      }

      const statusCode = Number(err?.response?.status || 0);
      if (isAuthFailureStatus(statusCode)) {
        clearUserAccessToken();
        applyUserState(null);
      }
    } finally {
      if (bootstrapRunIdRef.current === runId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void bootstrapAuth();

    return () => {
      bootstrapRunIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleSessionSync = (event) => {
      const source = String(event?.detail?.source || "").toLowerCase();
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

    window.addEventListener(AUTH_SESSION_SYNC_EVENT, handleSessionSync);
    return () => {
      window.removeEventListener(AUTH_SESSION_SYNC_EVENT, handleSessionSync);
    };
  }, []);

  const register = async (userData) => {
    try {
      setError(null);
      const response = await userAPI.register(userData);
      if (response.accessToken || response.token) {
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
      const message = err.response?.data?.error || "Registration failed";
      setError(message);
      return { success: false, message };
    }
  };

  const login = async (email, password, rememberMe = false) => {
    void rememberMe;

    try {
      setError(null);
      const response = await userAPI.login({ email, password });

      if (response.accessToken || response.token) {
        const loginRole = String(response?.user?.role || "")
          .trim()
          .toLowerCase();

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
      const responseData = err.response?.data || {};
      const message = responseData.error || "Login failed";
      const isAdmin = Boolean(responseData.isAdmin);
      setError(message);
      return {
        success: false,
        message,
        isAdmin,
        redirect: responseData.redirect || null,
      };
    }
  };

  const loginWithGoogle = async (idToken) => {
    try {
      setError(null);
      const response = await userAPI.loginWithGoogle(idToken);

      if (response.accessToken || response.token) {
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
      const message = err.response?.data?.error || "Google login failed";
      setError(message);
      return { success: false, message };
    }
  };

  const logout = async () => {
    try {
      await userAPI.logout();
    } catch (err) {
      // Local cleanup still happens if network logout fails.
    } finally {
      clearUserAccessToken();
      applyUserState(null);
      setError(null);
    }
  };

  const forgotPassword = async (email) => {
    try {
      setError(null);
      await userAPI.forgotPassword({ email });
      return { success: true, message: "Reset link sent to your email" };
    } catch (err) {
      const message = err.response?.data?.error || "Failed to send reset link";
      setError(message);
      return { success: false, message };
    }
  };

  const resetPassword = async (token, newPassword) => {
    try {
      setError(null);
      await userAPI.resetPassword({ token, newPassword });
      return { success: true, message: "Password reset successfully" };
    } catch (err) {
      const message = err.response?.data?.error || "Password reset failed";
      setError(message);
      return { success: false, message };
    }
  };

  const updateProfile = async (updates) => {
    try {
      setError(null);
      const response = await userAPI.updateProfile(updates);
      let updatedUser = normalizeUserObject(resolveUserFromPayload(response));

      if (!updatedUser) {
        updatedUser = await refreshProfile();
      }

      if (!updatedUser) {
        updatedUser = normalizeUserObject({ ...(user || {}), ...updates }) || {
          ...(user || {}),
          ...updates,
        };
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
      const message = err.response?.data?.error || "Failed to update profile";
      setError(message);
      return { success: false, message };
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    loginWithGoogle,
    register,
    logout,
    forgotPassword,
    resetPassword,
    updateProfile,
    refreshProfile,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
