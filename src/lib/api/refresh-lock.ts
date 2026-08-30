/**
 * Cross-tab mutual exclusion for the access-token refresh.
 *
 * Refresh tokens rotate server-side, so two tabs refreshing at once means one
 * of them presents a token that was already spent and gets logged out. The Web
 * Locks API handles that where it exists; the `localStorage` path below is the
 * fallback for browsers (and private modes) where it does not.
 */

const REFRESH_LOCK_KEY = "naturanza:user-refresh-lock";
const REFRESH_LOCK_NAME = "naturanza-user-refresh";
const REFRESH_LOCK_LEASE_MS = 15_000;

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

/**
 * Runs `operation` under the cross-tab lock. Every failure mode — no lock API,
 * no `window`, `localStorage` throwing behind a privacy setting, or the lease
 * simply timing out — falls through to running the operation unguarded. A
 * contended lock must never strand a user in a logged-out state.
 */
export const withCrossTabRefreshLock = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK_NAME, operation);
  }

  if (typeof window === "undefined") {
    return operation();
  }

  let storage: Storage | undefined;
  try {
    storage = window.localStorage;
  } catch {
    return operation();
  }
  if (!storage) {
    return operation();
  }

  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const deadline = Date.now() + REFRESH_LOCK_LEASE_MS;

  while (Date.now() < deadline) {
    let currentValue: string | null;
    try {
      currentValue = storage.getItem(REFRESH_LOCK_KEY);
    } catch {
      return operation();
    }
    const currentExpiry = Number(currentValue?.split(":").pop() || 0);

    if (!currentValue || currentExpiry <= Date.now()) {
      const lockValue = `${owner}:${Date.now() + REFRESH_LOCK_LEASE_MS}`;
      try {
        storage.setItem(REFRESH_LOCK_KEY, lockValue);
      } catch {
        return operation();
      }

      // Re-read rather than trust the write: another tab may have raced us
      // between the read and the write, and last writer wins.
      if (storage.getItem(REFRESH_LOCK_KEY) === lockValue) {
        try {
          return await operation();
        } finally {
          if (storage.getItem(REFRESH_LOCK_KEY) === lockValue) {
            storage.removeItem(REFRESH_LOCK_KEY);
          }
        }
      }
    }

    await delay(100);
  }

  // Modern browsers use navigator.locks; this fallback must not strand a user.
  return operation();
};
