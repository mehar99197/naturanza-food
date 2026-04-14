import React, { createContext, useContext, useState, useEffect } from "react";
import { AUTH_SESSION_SYNC_EVENT, userAPI } from "@/services/api";

const AuthContext = createContext(null);

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";
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

  // Handle DB-stored relative paths like "images/avatars/..." or "uploads/..."
  if (/^(images|uploads)\//i.test(normalizedPath)) {
    return `${API_ORIGIN}/${normalizedPath}`;
  }

  return normalizedPath;
};

const hasUserProfileImage = (candidate) =>
  Boolean(
    candidate?.profile_image || candidate?.profileImage || candidate?.avatar,
  );

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

const getStoredAuthToken = () =>
  localStorage.getItem("authToken") || sessionStorage.getItem("authToken");

const getCachedUserData = () => {
  const cachedUser = localStorage.getItem("userData");
  if (!cachedUser) {
    return null;
  }

  try {
    return normalizeUserObject(JSON.parse(cachedUser));
  } catch (parseError) {
    localStorage.removeItem("userData");
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
  const [user, setUser] = useState(() => {
    const token = getStoredAuthToken();
    return token ? getCachedUserData() : null;
  });
  const [loading, setLoading] = useState(() => Boolean(getStoredAuthToken()));
  const [error, setError] = useState(null);

  const applyUserState = (nextUser) => {
    const normalizedUser = normalizeUserObject(nextUser);
    setUser(normalizedUser);

    if (normalizedUser) {
      localStorage.setItem("userData", JSON.stringify(normalizedUser));
      if (hasUserProfileImage(normalizedUser)) {
        localStorage.setItem("profileImage", normalizedUser.profile_image);
      } else {
        localStorage.removeItem("profileImage");
      }
    } else {
      localStorage.removeItem("userData");
      localStorage.removeItem("profileImage");
    }

    return normalizedUser;
  };

  const refreshProfile = async () => {
    try {
      const profileResponse = await userAPI.getProfile();
      const refreshedUser = applyUserState(
        resolveUserFromPayload(profileResponse),
      );
      return refreshedUser;
    } catch (err) {
      return null;
    }
  };

  // Check for existing token and fetch user profile on mount
  useEffect(() => {
    const verifyAuth = async () => {
      const token = getStoredAuthToken();

      if (!token) {
        applyUserState(null);
        setLoading(false);
        return;
      }

      const cachedUser = getCachedUserData();
      if (cachedUser) {
        applyUserState(cachedUser);
      }

      try {
        const profile = await userAPI.getProfile();
        const resolvedUser = applyUserState(resolveUserFromPayload(profile));
        if (!resolvedUser) {
          throw new Error("Invalid profile response");
        }
        setError(null);
      } catch (err) {
        // Only clear tokens if it's an authentication error (401 or 403)
        if (err.response?.status === 401 || err.response?.status === 403) {
          console.log("Token is invalid or expired, clearing...");
          localStorage.removeItem("authToken");
          sessionStorage.removeItem("authToken");
          applyUserState(null);
        } else {
          // For network errors, keep token and preserve cached user if available
          console.log("Network error during auth verification, keeping token");
          const fallbackUser = cachedUser || getCachedUserData();
          if (!fallbackUser) {
            applyUserState(null);
          }
        }
      }

      setLoading(false);
    };

    verifyAuth();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncUserSessionState = async () => {
      const token = getStoredAuthToken();

      if (!token) {
        applyUserState(null);
        setLoading(false);
        return;
      }

      const cachedUser = getCachedUserData();
      if (cachedUser) {
        applyUserState(cachedUser);
      }

      await refreshProfile();
      setLoading(false);
    };

    const handleSessionSync = (event) => {
      const source = String(event?.detail?.source || "").toLowerCase();
      if (source.startsWith("admin-")) {
        return;
      }

      void syncUserSessionState();
    };

    const handleStorageSync = (event) => {
      if (
        event?.key &&
        !["authToken", "userData"].includes(event.key)
      ) {
        return;
      }

      void syncUserSessionState();
    };

    window.addEventListener(AUTH_SESSION_SYNC_EVENT, handleSessionSync);
    window.addEventListener("storage", handleStorageSync);

    return () => {
      window.removeEventListener(AUTH_SESSION_SYNC_EVENT, handleSessionSync);
      window.removeEventListener("storage", handleStorageSync);
    };
  }, []);

  // Register function
  const register = async (userData) => {
    try {
      setError(null);
      const response = await userAPI.register(userData);

      if (response.token) {
        localStorage.setItem("authToken", response.token);
        // Fetch user profile after login
        try {
          const profileResponse = await userAPI.getProfile();
          const profileUser = applyUserState(
            resolveUserFromPayload(profileResponse),
          );
          if (!profileUser) {
            throw new Error("Invalid profile response");
          }
        } catch (profileErr) {
          // Set user from response if available
          applyUserState(
            response.user || { email: userData.email, name: userData.name },
          );
        }
        return { success: true };
      }

      return {
        success: false,
        message: response.error || "Registration failed",
      };
    } catch (err) {
      const message = err.response?.data?.error || "Registration failed";
      setError(message);
      return { success: false, message };
    }
  };

  // Login function
  const login = async (email, password, rememberMe = false) => {
    try {
      setError(null);
      const response = await userAPI.login({ email, password });

      if (response.token) {
        if (rememberMe) {
          localStorage.setItem("authToken", response.token);
        } else {
          sessionStorage.setItem("authToken", response.token);
        }

        // Fetch user profile
        try {
          const profileResponse = await userAPI.getProfile();
          const profileUser = applyUserState(
            resolveUserFromPayload(profileResponse),
          );
          if (!profileUser) {
            throw new Error("Invalid profile response");
          }
        } catch (profileErr) {
          // Set user from login response if available
          const fallbackUser = applyUserState(response.user || { email });

          // Retry profile hydration in background to avoid stale/no-image login state.
          if (!hasUserProfileImage(fallbackUser)) {
            setTimeout(() => {
              void refreshProfile();
            }, 120);
          }
        }
        return { success: true };
      }

      const message = response.error || "Login failed";
      setError(message);
      return { success: false, message };
    } catch (err) {
      const message = err.response?.data?.error || "Login failed";
      setError(message);
      return { success: false, message };
    }
  };

  // Google Sign-In with ID token verification on backend
  const loginWithGoogle = async (idToken) => {
    try {
      setError(null);
      const response = await userAPI.loginWithGoogle(idToken);

      if (response.token) {
        localStorage.setItem("authToken", response.token);
        const googleUser = applyUserState(resolveUserFromPayload(response));

        // Social login payloads may be minimal; refresh full profile to get stored image/details.
        if (!googleUser || !hasUserProfileImage(googleUser)) {
          await refreshProfile();
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

  // Logout function
  const logout = async () => {
    try {
      await userAPI.logout();
    } catch (err) {
    } finally {
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("authToken");
      localStorage.removeItem("userData");
      applyUserState(null);
      setError(null);
    }
  };

  // Forgot Password
  const forgotPassword = async (email) => {
    try {
      setError(null);
      const response = await userAPI.forgotPassword({ email });
      return { success: true, message: "Reset link sent to your email" };
    } catch (err) {
      const message = err.response?.data?.error || "Failed to send reset link";
      setError(message);
      return { success: false, message };
    }
  };

  // Reset Password
  const resetPassword = async (token, newPassword) => {
    try {
      setError(null);
      const response = await userAPI.resetPassword({ token, newPassword });
      return { success: true, message: "Password reset successfully" };
    } catch (err) {
      const message = err.response?.data?.error || "Password reset failed";
      setError(message);
      return { success: false, message };
    }
  };

  // Update user profile
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
