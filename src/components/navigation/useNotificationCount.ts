"use client";

/**
 * Unread-notification count for the header bell.
 *
 * Polls on login, on every route change and on a 45s interval, and rings a soft
 * chime when the number goes *up* — never on the first response, which would
 * otherwise chime on every page load for anyone with unread items.
 */

import { useEffect, useRef, useState } from "react";

import { userNotificationEndpoints } from "@/lib/api/notifications";

import {
  playNotificationChime,
  primeNotificationSound,
} from "./notificationSound";

const POLL_INTERVAL_MS = 45000;

interface UnreadCountResponse {
  count?: number | string | null;
}

/**
 * @param loading  Auth is still resolving; hold off rather than poll as a guest.
 * @param userId   Restarts the poll when the signed-in account changes.
 * @param pathname Re-fetches on navigation, matching the source's dependency on
 *                 `location.pathname`.
 */
export function useNotificationCount(
  loading: boolean,
  userId: string | number | null | undefined,
  pathname: string,
): number {
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  // null means "no response yet", which is distinct from a genuine 0 and is what
  // suppresses the chime on the first fetch of a session.
  const prevNotifUnreadRef = useRef<number | null>(null);

  useEffect(() => {
    if (loading || !userId) {
      setNotifUnreadCount(0);
      prevNotifUnreadRef.current = null;
      return undefined;
    }

    primeNotificationSound();
    let cancelled = false;

    const fetchUnread = () => {
      userNotificationEndpoints
        .getNotificationsUnreadCount<UnreadCountResponse>()
        .then((data) => {
          if (cancelled) return;
          const count = Number(data?.count) || 0;
          // Ring only when the count increases, and not on the first fetch.
          if (
            prevNotifUnreadRef.current !== null &&
            count > prevNotifUnreadRef.current
          ) {
            playNotificationChime();
          }
          prevNotifUnreadRef.current = count;
          setNotifUnreadCount(count);
        })
        .catch(() => {
          if (!cancelled) setNotifUnreadCount(0);
        });
    };

    fetchUnread();
    const intervalId = window.setInterval(fetchUnread, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [loading, userId, pathname]);

  return notifUnreadCount;
}
