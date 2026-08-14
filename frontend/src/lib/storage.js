const getStorage = (kind) => {
  try {
    if (typeof window === "undefined") return null;
    return window[kind] || null;
  } catch {
    return null;
  }
};

export const safeStorage = {
  get(kind, key) {
    try {
      return getStorage(kind)?.getItem(key) || null;
    } catch {
      return null;
    }
  },
  set(kind, key, value) {
    try {
      getStorage(kind)?.setItem(key, value);
    } catch { /* ignored: not fatal to this flow */ }
  },
  remove(kind, key) {
    try {
      getStorage(kind)?.removeItem(key);
    } catch { /* ignored: not fatal to this flow */ }
  },
};

export const safeLocalStorage = {
  getItem: (key) => safeStorage.get("localStorage", key),
  setItem: (key, value) => safeStorage.set("localStorage", key, value),
  removeItem: (key) => safeStorage.remove("localStorage", key),
};

export const safeSessionStorage = {
  getItem: (key) => safeStorage.get("sessionStorage", key),
  setItem: (key, value) => safeStorage.set("sessionStorage", key, value),
  removeItem: (key) => safeStorage.remove("sessionStorage", key),
};
