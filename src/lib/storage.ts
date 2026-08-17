/**
 * Web Storage that never throws, ported from frontend/src/lib/storage.js.
 *
 * Every access is wrapped because `window.localStorage` is not merely absent
 * during server rendering — reading the property itself throws in Safari
 * private mode and under a blocked-cookies policy, and `setItem` throws once
 * the quota is full. Callers treat storage as a cache, so a failure degrades to
 * "no value" instead of breaking the render.
 */

export type StorageKind = "localStorage" | "sessionStorage";

const getStorage = (kind: StorageKind): Storage | null => {
  try {
    if (typeof window === "undefined") return null;
    return window[kind] || null;
  } catch {
    return null;
  }
};

export interface SafeStorage {
  get(kind: StorageKind, key: string): string | null;
  set(kind: StorageKind, key: string, value: string): void;
  remove(kind: StorageKind, key: string): void;
}

export const safeStorage: SafeStorage = {
  get(kind, key) {
    try {
      // `|| null` rather than `?? null`: a stored empty string reads back as
      // null. Preserved from the original — callers treat "" as absent.
      return getStorage(kind)?.getItem(key) || null;
    } catch {
      return null;
    }
  },
  set(kind, key, value) {
    try {
      getStorage(kind)?.setItem(key, value);
    } catch {
      /* ignored: not fatal to this flow */
    }
  },
  remove(kind, key) {
    try {
      getStorage(kind)?.removeItem(key);
    } catch {
      /* ignored: not fatal to this flow */
    }
  },
};

/** Subset of the Storage interface these wrappers expose. */
export interface SafeStorageArea {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const safeLocalStorage: SafeStorageArea = {
  getItem: (key) => safeStorage.get("localStorage", key),
  setItem: (key, value) => safeStorage.set("localStorage", key, value),
  removeItem: (key) => safeStorage.remove("localStorage", key),
};

export const safeSessionStorage: SafeStorageArea = {
  getItem: (key) => safeStorage.get("sessionStorage", key),
  setItem: (key, value) => safeStorage.set("sessionStorage", key, value),
  removeItem: (key) => safeStorage.remove("sessionStorage", key),
};
