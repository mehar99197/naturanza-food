import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { userAPI } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";

const AdminNotificationsContext = createContext(null);
const NOTIFICATION_POLL_INTERVAL_MS = 10000;
const NOTIFICATION_LIMIT = 50;

const normalizeNotifications = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    is_read: Boolean(row?.is_read),
  }));

const getRequestErrorMessage = (error, fallback) =>
  error?.response?.data?.error || error?.message || fallback;

export const useAdminNotifications = () => {
  const context = useContext(AdminNotificationsContext);
  if (!context) {
    throw new Error("useAdminNotifications must be used within an AdminNotificationsProvider");
  }

  return context;
};

export const AdminNotificationsProvider = ({ children }) => {
  const { isAdminAuthenticated } = useAdminAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [mutedUntil, setMutedUntil] = useState(null);

  const loadNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (!isAdminAuthenticated) {
        setNotifications([]);
        setIsMuted(false);
        setMutedUntil(null);
        setError("");
        setLoading(false);
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }

        const [notificationsResponse, settingsResponse] = await Promise.all([
          userAPI.getNotifications(NOTIFICATION_LIMIT),
          userAPI.getNotificationSettings(),
        ]);

        setNotifications(normalizeNotifications(notificationsResponse));
        setIsMuted(Boolean(settingsResponse?.isMuted));
        setMutedUntil(settingsResponse?.mutedUntil || null);
        setError("");
      } catch (requestError) {
        if (!silent) {
          setError(getRequestErrorMessage(requestError, "Failed to load notifications"));
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [isAdminAuthenticated],
  );

  const refreshNotifications = useCallback(async () => {
    await loadNotifications({ silent: false });
  }, [loadNotifications]);

  const markNotificationRead = useCallback(
    async (notificationId) => {
      if (!notificationId) {
        return;
      }

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? { ...item, is_read: true, read_at: item.read_at || new Date().toISOString() }
            : item,
        ),
      );

      try {
        await userAPI.markNotificationRead(notificationId);
      } catch (requestError) {
        await loadNotifications({ silent: true });
        throw requestError;
      }
    },
    [loadNotifications],
  );

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        is_read: true,
        read_at: item.read_at || new Date().toISOString(),
      })),
    );

    try {
      await userAPI.markAllNotificationsRead();
    } catch (requestError) {
      await loadNotifications({ silent: true });
      throw requestError;
    }
  }, [loadNotifications]);

  const updateMuteSettings = useCallback(async (nextSettings) => {
    const payload = {
      isMuted: Boolean(nextSettings?.isMuted),
      mutedForMinutes: Number(nextSettings?.mutedForMinutes) || null,
    };

    const response = await userAPI.updateNotificationSettings(payload);
    setIsMuted(Boolean(response?.isMuted));
    setMutedUntil(response?.mutedUntil || null);
    return response;
  }, []);

  useEffect(() => {
    if (!isAdminAuthenticated) {
      setNotifications([]);
      setIsMuted(false);
      setMutedUntil(null);
      setError("");
      setLoading(false);
      return;
    }

    void loadNotifications();
  }, [isAdminAuthenticated, loadNotifications]);

  useEffect(() => {
    if (!isAdminAuthenticated || typeof window === "undefined") {
      return undefined;
    }

    const pollTimerId = window.setInterval(() => {
      void loadNotifications({ silent: true });
    }, NOTIFICATION_POLL_INTERVAL_MS);

    const handleWindowFocus = () => {
      void loadNotifications({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadNotifications({ silent: true });
      }
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(pollTimerId);
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAdminAuthenticated, loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !Boolean(item.is_read)).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      isMuted,
      mutedUntil,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      updateMuteSettings,
    }),
    [
      error,
      isMuted,
      loading,
      markAllNotificationsRead,
      markNotificationRead,
      mutedUntil,
      notifications,
      refreshNotifications,
      unreadCount,
      updateMuteSettings,
    ],
  );

  return (
    <AdminNotificationsContext.Provider value={value}>
      {children}
    </AdminNotificationsContext.Provider>
  );
};
