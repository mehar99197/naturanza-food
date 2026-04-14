import React, { createContext, useContext, useState, useEffect } from "react";
import { AUTH_SESSION_SYNC_EVENT, adminAPI } from "@/services/api";

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
    localStorage.removeItem("adminAuthToken");
    localStorage.removeItem("adminData");
    setAdmin(null);
  };

  const verifyAdminToken = async () => {
    try {
      const response = await adminAPI.verify();
      if (response?.success && response?.admin) {
        setAdmin(response.admin);
        localStorage.setItem("adminData", JSON.stringify(response.admin));
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
    const token = localStorage.getItem("adminAuthToken");
    const adminData = localStorage.getItem("adminData");

    if (!token) {
      setLoading(false);
      return;
    }

    if (adminData) {
      try {
        const parsedAdmin = JSON.parse(adminData);
        setAdmin(parsedAdmin);
      } catch (error) {
        localStorage.removeItem("adminData");
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
        const token = localStorage.getItem("adminAuthToken");

        if (!token) {
          setAdmin(null);
          return;
        }

        const adminData = localStorage.getItem("adminData");
        if (adminData) {
          try {
            setAdmin(JSON.parse(adminData));
          } catch {
            localStorage.removeItem("adminData");
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
        if (event?.key && !["adminAuthToken", "adminData"].includes(event.key)) {
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

  // Admin login function
  const adminLogin = async (email, password) => {
    try {
      const response = await adminAPI.login({ email, password });

      if (response?.success && response?.token && response?.admin) {
        localStorage.setItem("adminData", JSON.stringify(response.admin));
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

  // Admin logout function
  const adminLogout = async () => {
    try {
      await adminAPI.logout();
    } catch (error) {
      // Local cleanup still happens even if backend logout fails.
    }
    clearAdminAuthState();
  };

  const value = {
    admin,
    loading,
    adminLogin,
    adminLogout,
    isAdminAuthenticated: !!admin,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};
