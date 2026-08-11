import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  AUTH_SESSION_SYNC_EVENT,
  adminAPI,
  clearAdminAccessToken,
} from "@/services/api";
import { FEATURE_PERMISSIONS } from "@/config/adminPermissions";

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

const AdminAuthContext = createContext(null);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const authGenerationRef = useRef(0);
  const loginInProgressRef = useRef(false);

  const clearAdminAuthState = () => {
    authGenerationRef.current += 1;
    clearAdminAccessToken();
    safeLocalStorage.removeItem("adminData");
    setAdmin(null);
    // Wipe the admin SWR cache too — on shared machines, the next admin user
    // would otherwise see the previous user's cached dashboard/reviews/etc.
    // Dynamic import to keep the auth context decoupled from the cache module.
    import("@/hooks/useSWRCache").then(({ clearSWRCache }) => clearSWRCache()).catch(() => {});
  };

  const applyAdminState = (nextAdmin) => {
    setAdmin(nextAdmin);
    safeLocalStorage.setItem("adminData", JSON.stringify(nextAdmin));
  };

  const verifyAdminToken = async () => {
    try {
      const response = await adminAPI.verify();
      if (response?.success && response?.admin) {
        return { state: "valid", admin: response.admin };
      }

      if (response?.status === 401 || response?.status === 403) {
        return { state: "invalid" };
      }

      return { state: "unknown" };
    } catch (error) {
      return { state: "unknown" };
    }
  };

  // Check for existing admin token on mount
  useEffect(() => {
    const adminData = safeLocalStorage.getItem("adminData");

    if (!adminData) {
      setLoading(false);
      return;
    }

    if (adminData) {
      try {
        const parsedAdmin = JSON.parse(adminData);
        setAdmin(parsedAdmin);
      } catch (error) {
        safeLocalStorage.removeItem("adminData");
        setLoading(false);
        return;
      }
    }

    const verificationGeneration = authGenerationRef.current;
    verifyAdminToken().then((verificationResult) => {
      if (authGenerationRef.current !== verificationGeneration) {
        return;
      }

      if (verificationResult.state === "valid") {
        applyAdminState(verificationResult.admin);
      } else if (verificationResult.state === "invalid") {
        clearAdminAuthState();
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    } else {
      const syncAdminSessionState = async () => {
        const verificationGeneration = authGenerationRef.current;
        const adminData = safeLocalStorage.getItem("adminData");
        if (adminData) {
          try {
            setAdmin(JSON.parse(adminData));
          } catch {
            safeLocalStorage.removeItem("adminData");
          }
        }

        const verificationResult = await verifyAdminToken();
        if (authGenerationRef.current !== verificationGeneration) {
          return;
        }

        if (verificationResult.state === "valid") {
          applyAdminState(verificationResult.admin);
        } else if (verificationResult.state === "invalid") {
          clearAdminAuthState();
        }
      };

      const handleSessionSync = (event) => {
        const source = String(event?.detail?.source || "").toLowerCase();
        if (source.startsWith("user-")) {
          return;
        }

        if (source === "admin-token-invalid") {
          if (loginInProgressRef.current) {
            return;
          }
          clearAdminAuthState();
          setLoading(false);
          return;
        }

        void syncAdminSessionState();
      };

      const handleStorageSync = (event) => {
        if (event?.key && event.key !== "adminData") {
          return;
        }

        if (!safeLocalStorage.getItem("adminData")) {
          if (loginInProgressRef.current) {
            return;
          }
          clearAdminAuthState();
          setLoading(false);
          return;
        }

        void syncAdminSessionState();
      };

      window.addEventListener(AUTH_SESSION_SYNC_EVENT, handleSessionSync);
      window.addEventListener("storage", handleStorageSync);

      return () => {
        window.removeEventListener(AUTH_SESSION_SYNC_EVENT, handleSessionSync);
        window.removeEventListener("storage", handleStorageSync);
      };
    }
  }, []);

  // Super-admin login: hits /admin/login, rejected if admin_role !== 'super_admin'.
  const adminLogin = async (email, password, otpCode = "") => {
    authGenerationRef.current += 1;
    loginInProgressRef.current = true;
    try {
      const response = await adminAPI.login({ email, password, ...(otpCode ? { otpCode } : {}) });

      if (response?.success && response?.token && response?.admin) {
        applyAdminState(response.admin);
        return { success: true };
      }

      return {
        success: false,
        requiresTwoFactor: response?.requiresTwoFactor === true,
        message: response?.error || "Invalid admin credentials.",
      };
    } catch (error) {
      return {
        success: false,
        requiresTwoFactor: error?.response?.data?.requiresTwoFactor === true,
        message:
          error?.response?.data?.error ||
          "Admin login failed. Please check your credentials.",
      };
    } finally {
      loginInProgressRef.current = false;
    }
  };

  // Staff login: hits /admin/staff-login. Rejected if admin_role is 'super_admin'
  // or NULL. The success path produces the same session shape as adminLogin —
  // downstream permission checks discriminate via admin_role on the record.
  const staffLogin = async (email, password, otpCode = "") => {
    authGenerationRef.current += 1;
    loginInProgressRef.current = true;
    try {
      const response = await adminAPI.staffLogin({ email, password, ...(otpCode ? { otpCode } : {}) });

      if (response?.success && response?.token && response?.admin) {
        applyAdminState(response.admin);
        return { success: true };
      }

      return {
        success: false,
        requiresTwoFactor: response?.requiresTwoFactor === true,
        message: response?.error || "Invalid staff credentials.",
      };
    } catch (error) {
      return {
        success: false,
        requiresTwoFactor: error?.response?.data?.requiresTwoFactor === true,
        message:
          error?.response?.data?.error ||
          "Staff login failed. Please check your credentials.",
      };
    } finally {
      loginInProgressRef.current = false;
    }
  };

  // Admin logout function
  const adminLogout = async () => {
    try {
      await adminAPI.logout();
    } catch (error) {
      // Local cleanup still happens even if backend logout fails.
    }
    clearAdminAuthState();
  };

  // Check if current admin is super admin
  const isSuperAdmin = admin?.admin_role === 'super_admin';

  // Check if admin has specific permission
  const hasPermission = (permission) => {
    // Super admin has all permissions
    if (isSuperAdmin) return true;
    
    // Check if permission exists in admin_permissions array
    const permissions = admin?.admin_permissions;
    if (!permissions || !Array.isArray(permissions)) return false;
    
    return permissions.includes(permission);
  };

  // Check if admin can access a specific feature.
  // Lookup rules in FEATURE_PERMISSIONS:
  //   key missing OR value undefined → visible to every admin
  //   value null                     → super_admin only
  //   value string                   → required permission key
  const canAccess = (feature) => {
    if (!(feature in FEATURE_PERMISSIONS)) return true;
    const required = FEATURE_PERMISSIONS[feature];
    if (required === undefined) return true;
    if (required === null) return isSuperAdmin;
    return hasPermission(required);
  };

  const value = {
    admin,
    loading,
    adminLogin,
    staffLogin,
    adminLogout,
    isAdminAuthenticated: !!admin,
    isSuperAdmin,
    hasPermission,
    canAccess,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};
