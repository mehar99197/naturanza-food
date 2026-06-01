import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { adminAPI } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { playNotificationChime, primeNotificationSound } from "@/lib/notificationSound";

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
  const { isAdminAuthenticated, loading: adminLoading } = useAdminAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [mutedUntil, setMutedUntil] = useState(null);
  // Highest notification id we've seen — lets us detect a genuinely NEW
  // notification on a silent poll and chime for it (null = not initialised yet).
  const lastSeenMaxIdRef = useRef(null);

  const loadNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (adminLoading || !isAdminAuthenticated) {
        setNotifications([]);
        setIsMuted(false);
        setMutedUntil(null);
        setError("");
        setLoading(false);
        lastSeenMaxIdRef.current = null;
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }

        const [notificationsResponse, settingsResponse] = await Promise.all([
          adminAPI.getNotifications(NOTIFICATION_LIMIT),
          adminAPI.getNotificationSettings(),
        ]);

        const normalized = normalizeNotifications(notificationsResponse);
        const muted = Boolean(settingsResponse?.isMuted);

        // Ring only for a notification newer than the highest we'd seen before,
        // and not on the very first load (so existing items stay silent).
        const maxId = normalized.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
        if (lastSeenMaxIdRef.current !== null && maxId > lastSeenMaxIdRef.current && !muted) {
          playNotificationChime();
        }
        lastSeenMaxIdRef.current = maxId;

        setNotifications(normalized);
        setIsMuted(muted);
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
    [adminLoading, isAdminAuthenticated],
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
        await adminAPI.markNotificationRead(notificationId);
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
      await adminAPI.markAllNotificationsRead();
    } catch (requestError) {
      await loadNotifications({ silent: true });
      throw requestError;
    }
  }, [loadNotifications]);

  const deleteNotification = useCallback(
    async (notificationId) => {
      if (!notificationId) {
        return;
      }
      setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
      try {
        await adminAPI.deleteNotification(notificationId);
      } catch (requestError) {
        await loadNotifications({ silent: true });
        throw requestError;
      }
    },
    [loadNotifications],
  );

  const clearAllNotifications = useCallback(async () => {
    setNotifications([]);
    try {
      await adminAPI.clearNotifications();
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

    const response = await adminAPI.updateNotificationSettings(payload);
    setIsMuted(Boolean(response?.isMuted));
    setMutedUntil(response?.mutedUntil || null);
    return response;
  }, []);

  useEffect(() => {
    if (adminLoading || !isAdminAuthenticated) {
      setNotifications([]);
      setIsMuted(false);
      setMutedUntil(null);
      setError("");
      setLoading(false);
      return;
    }

    void loadNotifications();
  }, [adminLoading, isAdminAuthenticated, loadNotifications]);

  useEffect(() => {
    if (adminLoading || !isAdminAuthenticated || typeof window === "undefined") {
      return undefined;
    }

    // Unlock audio on the admin's first interaction so the chime can play.
    primeNotificationSound();

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
  }, [adminLoading, isAdminAuthenticated, loadNotifications]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
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
      deleteNotification,
      clearAllNotifications,
      updateMuteSettings,
    }),
    [
      error,
      isMuted,
      loading,
      markAllNotificationsRead,
      markNotificationRead,
      deleteNotification,
      clearAllNotifications,
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
