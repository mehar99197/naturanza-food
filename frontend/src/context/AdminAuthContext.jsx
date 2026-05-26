import React, { createContext, useContext, useState, useEffect } from "react";
import {
  AUTH_SESSION_SYNC_EVENT,
  adminAPI,
  clearAdminAccessToken,
  getAdminAccessToken,
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

  const clearAdminAuthState = () => {
    clearAdminAccessToken();
    safeLocalStorage.removeItem("adminData");
    setAdmin(null);
    // Wipe the admin SWR cache too — on shared machines, the next admin user
    // would otherwise see the previous user's cached dashboard/reviews/etc.
    // Dynamic import to keep the auth context decoupled from the cache module.
    import("@/hooks/useSWRCache").then(({ clearSWRCache }) => clearSWRCache()).catch(() => {});
  };

  const verifyAdminToken = async () => {
    try {
      const response = await adminAPI.verify();
      if (response?.success && response?.admin) {
        setAdmin(response.admin);
        safeLocalStorage.setItem("adminData", JSON.stringify(response.admin));
        return "valid";
      }

      if (response?.status === 401 || response?.status === 403) {
        return "invalid";
      }

      return "unknown";
    } catch (error) {
      return "unknown";
    }
  };

  // Check for existing admin token on mount
  useEffect(() => {
    const token = getAdminAccessToken();
    const adminData = safeLocalStorage.getItem("adminData");

    if (!token) {
      safeLocalStorage.removeItem("adminData");
      setLoading(false);
      return;
    }

    if (adminData) {
      try {
        const parsedAdmin = JSON.parse(adminData);
        setAdmin(parsedAdmin);
      } catch (error) {
        safeLocalStorage.removeItem("adminData");
      }
    }

    verifyAdminToken().then((verificationState) => {
      if (verificationState === "invalid") {
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
        const token = getAdminAccessToken();

        if (!token) {
          safeLocalStorage.removeItem("adminData");
          setAdmin(null);
          return;
        }

        const adminData = safeLocalStorage.getItem("adminData");
        if (adminData) {
          try {
            setAdmin(JSON.parse(adminData));
          } catch {
            safeLocalStorage.removeItem("adminData");
          }
        }

        const verificationState = await verifyAdminToken();
        if (verificationState === "invalid") {
          clearAdminAuthState();
        }
      };

      const handleSessionSync = (event) => {
        const source = String(event?.detail?.source || "").toLowerCase();
        if (source.startsWith("user-")) {
          return;
        }

        void syncAdminSessionState();
      };

      const handleStorageSync = (event) => {
        if (event?.key && event.key !== "adminData") {
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
  const adminLogin = async (email, password) => {
    try {
      const response = await adminAPI.login({ email, password });

      if (response?.success && response?.token && response?.admin) {
        safeLocalStorage.setItem("adminData", JSON.stringify(response.admin));
        setAdmin(response.admin);
        return { success: true };
      }

      return {
        success: false,
        message: response?.error || "Invalid admin credentials.",
      };
    } catch (error) {
      return {
        success: false,
        message:
          error?.response?.data?.error ||
          "Admin login failed. Please check your credentials.",
      };
    }
  };

  // Staff login: hits /admin/staff-login. Rejected if admin_role is 'super_admin'
  // or NULL. The success path produces the same session shape as adminLogin —
  // downstream permission checks discriminate via admin_role on the record.
  const staffLogin = async (email, password) => {
    try {
      const response = await adminAPI.staffLogin({ email, password });

      if (response?.success && response?.token && response?.admin) {
        safeLocalStorage.setItem("adminData", JSON.stringify(response.admin));
        setAdmin(response.admin);
        return { success: true };
      }

      return {
        success: false,
        message: response?.error || "Invalid staff credentials.",
      };
    } catch (error) {
      return {
        success: false,
        message:
          error?.response?.data?.error ||
          "Staff login failed. Please check your credentials.",
      };
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
