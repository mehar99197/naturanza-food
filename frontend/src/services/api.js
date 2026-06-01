import axios from "axios";

const resolveApiBaseUrl = () => {
  const configuredApiUrl = String(import.meta.env.VITE_API_URL || "").trim();
  if (configuredApiUrl) {
    return configuredApiUrl;
  }

  if (typeof window !== "undefined") {
    const protocol = String(window.location.protocol || "http:");
    const hostname = String(window.location.hostname || "localhost");
    const apiPort = Number.parseInt(
      String(import.meta.env.VITE_API_PORT || "5000"),
      10,
    );
    const safePort = Number.isFinite(apiPort) && apiPort > 0 ? apiPort : 5000;

    return `${protocol}//${hostname}:${safePort}/api`;
  }

  return "http://localhost:5000/api";
};

// Create axios instance pointing to backend
const API_BASE_URL = resolveApiBaseUrl();

const INVOICE_DOWNLOAD_TIMEOUT_MS = Math.max(
  Number.parseInt(import.meta.env.VITE_INVOICE_DOWNLOAD_TIMEOUT_MS || "120000", 10) ||
    120000,
  10000,
);

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 10000,
});

const csrfAxios = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 10000,
});

let csrfToken = null;
let csrfTokenPromise = null;

const fetchCsrfToken = async () => {
  const response = await csrfAxios.get("/csrf-token");
  const nextToken = response?.data?.csrfToken || null;
  if (nextToken) {
    csrfToken = String(nextToken);
  }
  return csrfToken;
};

const ensureCsrfToken = async () => {
  if (csrfToken) {
    return csrfToken;
  }

  if (!csrfTokenPromise) {
    csrfTokenPromise = fetchCsrfToken().finally(() => {
      csrfTokenPromise = null;
    });
  }

  return csrfTokenPromise;
};

// Add response interceptor to handle timeout and network errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      error.isTimeout = true;
      error.customMessage = 'Request timed out. Please check your connection and try again.';
    } else if (!error.response) {
      error.isNetworkError = true;
      error.customMessage = 'Unable to connect to server. Please check your internet connection.';
    }
    return Promise.reject(error);
  }
);

export const AUTH_SESSION_SYNC_EVENT = "naturanza:auth-session-sync";

const ADMIN_ACCESS_TOKEN_STORAGE_KEY = "adminAccessToken";
const USER_ACCESS_TOKEN_STORAGE_KEY = "token";
const USER_SESSION_STORAGE_KEY = "userSessionActive";

const canUseWebStorage = () =>
  typeof window !== "undefined" &&
  typeof window.localStorage !== "undefined" &&
  typeof window.sessionStorage !== "undefined";

const readStoredAdminAccessToken = () => {
  if (!canUseWebStorage()) {
    return null;
  }

  const storedToken = String(
    window.localStorage.getItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY) || "",
  ).trim();

  return storedToken || null;
};

const readStoredUserAccessToken = () => {
  if (!canUseWebStorage()) {
    return null;
  }

  const storedToken = String(
    window.localStorage.getItem(USER_ACCESS_TOKEN_STORAGE_KEY) || "",
  ).trim();

  return storedToken || null;
};

const readStoredUserSessionFlag = () => {
  if (!canUseWebStorage()) {
    return false;
  }

  return window.localStorage.getItem(USER_SESSION_STORAGE_KEY) === "true";
};

let userAccessToken = readStoredUserAccessToken();
let adminAccessToken = readStoredAdminAccessToken();
let userSessionActive = readStoredUserSessionFlag();
let refreshPromise = null;

const purgeLegacyUserTokenStorage = () => {
  if (!canUseWebStorage()) {
    return;
  }

  window.localStorage.removeItem("authToken");
  window.sessionStorage.removeItem("authToken");
};

const purgeLegacyAdminTokenStorage = () => {
  if (!canUseWebStorage()) {
    return;
  }

  window.localStorage.removeItem("adminAuthToken");
};

export const setUserAccessToken = (token) => {
  userAccessToken = token ? String(token) : null;

  userSessionActive = Boolean(userAccessToken);

  if (!canUseWebStorage()) {
    return;
  }

  if (userAccessToken) {
    window.localStorage.setItem(USER_ACCESS_TOKEN_STORAGE_KEY, userAccessToken);
    window.localStorage.setItem(USER_SESSION_STORAGE_KEY, "true");
  } else {
    window.localStorage.removeItem(USER_ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_SESSION_STORAGE_KEY);
  }
};

export const getUserAccessToken = () => userAccessToken;

export const hasUserSession = () => userSessionActive;

export const clearUserAccessToken = () => {
  userAccessToken = null;
  userSessionActive = false;
  
  if (!canUseWebStorage()) {
    return;
  }

  window.localStorage.removeItem(USER_ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_SESSION_STORAGE_KEY);
};

export const setAdminAccessToken = (token) => {
  adminAccessToken = token ? String(token) : null;

  if (!canUseWebStorage()) {
    return;
  }

  if (adminAccessToken) {
    window.localStorage.setItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY, adminAccessToken);
  } else {
    window.localStorage.removeItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY);
  }
};

export const getAdminAccessToken = () => adminAccessToken;

export const clearAdminAccessToken = () => {
  adminAccessToken = null;

  if (!canUseWebStorage()) {
    return;
  }

  window.localStorage.removeItem(ADMIN_ACCESS_TOKEN_STORAGE_KEY);
};

purgeLegacyUserTokenStorage();
purgeLegacyAdminTokenStorage();

const clearUserSessionStorage = () => {
  clearUserAccessToken();
  purgeLegacyUserTokenStorage();
  if (canUseWebStorage()) {
    window.localStorage.removeItem("userData");
    window.localStorage.removeItem("profileImage");
    window.localStorage.removeItem(USER_SESSION_STORAGE_KEY);
  }
};

const clearAdminSessionStorage = () => {
  clearAdminAccessToken();
  if (canUseWebStorage()) {
    window.localStorage.removeItem("adminData");
  }
};

const emitAuthSessionSync = (source) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(AUTH_SESSION_SYNC_EVENT, {
      detail: {
        source,
        timestamp: Date.now(),
      },
    }),
  );
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Export emitAuthSessionSync for use in other modules
export { emitAuthSessionSync };

const shouldSkipCsrf = (method, url) => {
  if (SAFE_METHODS.has(method?.toUpperCase())) {
    return true;
  }
  if (url?.includes("/health") || url?.includes("/csrf-token")) {
    return true;
  }
  return false;
};

// Add token to requests
axiosInstance.interceptors.request.use(async (config) => {
  const adminToken = getAdminAccessToken();
  const userToken = getUserAccessToken();
  const requestUrl = String(config.url || "");
  const isUserScopedRoute =
    /^\/auth(\/|$)/.test(requestUrl) ||
    /^\/profile(\/|$)/.test(requestUrl) ||
    /^\/wishlist(\/|$)/.test(requestUrl) ||
    /^\/cart(\/|$)/.test(requestUrl) ||
    /^\/orders(\/|$)/.test(requestUrl) ||
    /^\/reviews(\/|$)/.test(requestUrl) ||
    /^\/payments(\/|$)/.test(requestUrl);
  const isAdminRoute =
    requestUrl.includes("/admin") ||
    requestUrl.includes("/admin-") ||
    /^\/admin(\/|$)/.test(requestUrl) ||
    /\/admin(\/|$)/.test(requestUrl);
  const isAdminPage =
    typeof window !== "undefined" &&
    /^\/admin(\/|$)/.test(String(window.location?.pathname || ""));

  let token = null;
  let authScope = "none";

  if (isAdminRoute || isAdminPage) {
    token = adminToken || null;
    authScope = token ? "admin" : "none";
  } else if (isUserScopedRoute) {
    token = userToken || null;
    authScope = token ? "user" : "none";
  }

  // For user-scoped routes, fall back to admin token if no user token is available
  if (!token && isUserScopedRoute && adminToken) {
    token = adminToken;
    authScope = "user";
  }

  config._authScope = authScope;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }

  if (!shouldSkipCsrf(config.method, requestUrl)) {
    try {
      const resolvedCsrfToken = await ensureCsrfToken();
      if (resolvedCsrfToken) {
        config.headers = config.headers || {};
        config.headers["x-csrf-token"] = resolvedCsrfToken;
      }
    } catch (error) {
      // Allow request to proceed without CSRF header if token fetch fails.
    }
  }

  return config;
});

// Handle response errors
const isAdminEndpoint = (url) =>
  url.includes("/admin-management") || url.includes("/admin/");

const isAuthEndpoint = (url) =>
  /^\/auth(\/|$)/.test(url) || url.includes("/auth/");

const isUserRoute = (url) =>
  /^\/auth(\/|$)/.test(url) ||
  /^\/profile(\/|$)/.test(url) ||
  /^\/wishlist(\/|$)/.test(url) ||
  /^\/cart(\/|$)/.test(url) ||
  /^\/orders(\/|$)/.test(url) ||
  /^\/reviews(\/|$)/.test(url) ||
  /^\/payments(\/|$)/.test(url);

const shouldSkipAuthRefresh = (request) => {
  const headers = request?.headers || {};
  const skipHeader =
    headers["X-Skip-Auth-Refresh"] ??
    headers["x-skip-auth-refresh"] ??
    headers["x-skip-auth-refresh".toLowerCase()];
  return String(skipHeader || "").toLowerCase() === "true";
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config || {};
    const status = Number(error?.response?.status || 0);
    const requestUrl = String(originalRequest.url || "");
    const responseData = error?.response?.data || {};
    const csrfCode = String(responseData?.code || "").toUpperCase();
    const isCsrfError =
      status === 403 &&
      (csrfCode === "CSRF_TOKEN_MISSING" || csrfCode === "CSRF_TOKEN_INVALID");

    if (isCsrfError && !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;
      csrfToken = null;

      try {
        const refreshedToken = await ensureCsrfToken();
        if (refreshedToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers["x-csrf-token"] = refreshedToken;
        }
        return axiosInstance(originalRequest);
      } catch (retryError) {
        return Promise.reject(error);
      }
    }

    // Don't retry auth endpoints (login, register, etc.)
    if (isAuthEndpoint(requestUrl)) {
      return Promise.reject(error);
    }

    // For admin endpoints - retry with admin token on 401
    if (status === 401 && isAdminEndpoint(requestUrl)) {
      const adminToken = getAdminAccessToken();
      if (adminToken && !originalRequest._retry) {
        originalRequest._retry = true;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${adminToken}`;
        return axiosInstance(originalRequest);
      }
      clearAdminSessionStorage();
      emitAuthSessionSync("admin-token-invalid");
      return Promise.reject(error);
    }

    // For user routes - auto-refresh token on 401/403 if not already retried
    if ((status === 401 || status === 403) &&
        isUserRoute(requestUrl) &&
        !originalRequest._retry &&
        !originalRequest._refreshRetry &&
        !shouldSkipAuthRefresh(originalRequest)) {
      originalRequest._refreshRetry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = axiosInstance
            .post(
              "/auth/refresh",
              {},
              { headers: { "X-Skip-Auth-Refresh": "true" } },
            )
            .then((refreshResponse) => {
              const newToken =
                refreshResponse.data?.accessToken || refreshResponse.data?.token;
              if (!newToken) {
                throw new Error("Refresh token missing");
              }
              setUserAccessToken(newToken);
              emitAuthSessionSync("user-token-refresh");
              return newToken;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const refreshedToken = await refreshPromise;
        if (refreshedToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - clear user session
        clearUserSessionStorage();
        emitAuthSessionSync("user-token-refresh-failed");
        return Promise.reject(error);
      }
    }

    if ((status === 401 || status === 403) && originalRequest._authScope === "admin") {
      clearAdminSessionStorage();
      emitAuthSessionSync("admin-token-invalid");
    }

    return Promise.reject(error);
  },
);

const getFilenameFromContentDisposition = (
  contentDisposition,
  fallback = "invoice.pdf",
) => {
  if (!contentDisposition) {
    return fallback;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    const encoded = utf8Match[1].replace(/['"]/g, "");
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded || fallback;
    }
  }

  const asciiMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }

  return fallback;
};

const normalizePdfBlob = (payload, contentType = "application/pdf") => {
  if (payload instanceof Blob) {
    return payload;
  }

  if (payload instanceof ArrayBuffer) {
    return new Blob([payload], { type: contentType || "application/pdf" });
  }

  if (typeof payload === "string") {
    return new Blob([payload], { type: contentType || "application/pdf" });
  }

  return new Blob([], { type: contentType || "application/pdf" });
};

const hasDownloadablePayload = (payload) => {
  if (payload instanceof Blob) {
    return payload.size > 0;
  }

  if (payload instanceof ArrayBuffer) {
    return payload.byteLength > 0;
  }

  if (typeof payload === "string") {
    return payload.length > 0;
  }

  return false;
};

// Product APIs
export const productAPI = {
  getAll: async (includeInactive = false) => {
    const response = await axiosInstance.get("/products", {
      params: includeInactive ? { includeInactive: 'true' } : {}
    });
    return response.data;
  },

  getById: async (id) => {
    const response = await axiosInstance.get(`/products/${id}`);
    return response.data;
  },

  getByCategory: async (category) => {
    const response = await axiosInstance.get("/products", {
      params: { category },
    });
    return response.data;
  },

  getFeatured: async () => {
    const response = await axiosInstance.get("/products", {
      params: { featured: true },
    });
    return response.data;
  },

  getRelated: async (productId) => {
    const product = await productAPI.getById(productId);
    if (!product) return [];
    return productAPI.getByCategory(product.category);
  },

  create: async (productData) => {
    const response = await axiosInstance.post("/products", productData);
    return response.data;
  },

  update: async (id, productData) => {
    const response = await axiosInstance.put(`/products/${id}`, productData);
    return response.data;
  },

  delete: async (id) => {
    const response = await axiosInstance.delete(`/products/${id}`);
    return response.data;
  },

  getReviews: async (productId) => {
    const response = await axiosInstance.get(`/products/${productId}/reviews`);
    return response.data;
  },

  addReview: async (productId, reviewData) => {
    const response = await axiosInstance.post(
      `/products/${productId}/reviews`,
      reviewData,
    );
    return response.data;
  },
};

// User APIs
export const userAPI = {
  register: async (userData) => {
    const response = await axiosInstance.post("/auth/register", userData);
    const nextToken = response.data.accessToken || response.data.token;
    if (nextToken) {
      setUserAccessToken(nextToken);
      emitAuthSessionSync("user-register");
    }
    return response.data;
  },

  verifyEmail: async ({ email, code }) => {
    const response = await axiosInstance.post("/auth/verify-email", { email, code });
    const nextToken = response.data.accessToken || response.data.token;
    if (nextToken) {
      setUserAccessToken(nextToken);
      emitAuthSessionSync("user-verify-email");
    }
    return response.data;
  },

  resendVerification: async (email) => {
    const response = await axiosInstance.post("/auth/resend-verification", { email });
    return response.data;
  },

  login: async (credentials) => {
    const response = await axiosInstance.post("/auth/login", credentials);
    const nextToken = response.data.accessToken || response.data.token;
    if (nextToken) {
      setUserAccessToken(nextToken);
      emitAuthSessionSync("user-login");
    }
    return response.data;
  },

  loginWithGoogle: async (idToken) => {
    const response = await axiosInstance.post("/auth/google", { idToken });
    const nextToken = response.data.accessToken || response.data.token;
    if (nextToken) {
      setUserAccessToken(nextToken);
      emitAuthSessionSync("user-google-login");
    }
    return response.data;
  },

  refreshToken: async () => {
    const response = await axiosInstance.post("/auth/refresh");
    const nextToken = response.data.accessToken || response.data.token;
    if (nextToken) {
      setUserAccessToken(nextToken);
      emitAuthSessionSync("user-token-refresh");
    }
    return response.data;
  },

  logout: async () => {
    try {
      await axiosInstance.post(
        "/auth/logout",
        {},
        {
          headers: {
            "X-Skip-Auth-Refresh": "true",
          },
        },
      );
    } catch (error) {}
    clearUserSessionStorage();
    emitAuthSessionSync("user-logout");
    return { success: true };
  },

  getProfile: async () => {
    const response = await axiosInstance.get("/auth/profile");
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await axiosInstance.put("/auth/profile", profileData);
    return response.data;
  },

  forgotPassword: async (data) => {
    const response = await axiosInstance.post("/auth/forgot-password", data);
    return response.data;
  },

  resetPassword: async (data) => {
    const response = await axiosInstance.post("/auth/reset-password", data);
    return response.data;
  },

  getStats: async () => {
    const response = await axiosInstance.get("/auth/stats");
    return response.data;
  },

  uploadProfileImage: async (formData) => {
    const response = await axiosInstance.post("/auth/profile/image", formData);
    return response.data;
  },

  deleteProfileImage: async () => {
    const response = await axiosInstance.delete("/auth/profile/image");
    return response.data;
  },

  getAddresses: async () => {
    const response = await axiosInstance.get("/auth/addresses");
    return response.data;
  },

  addAddress: async (addressData) => {
    const response = await axiosInstance.post("/auth/addresses", addressData);
    return response.data;
  },

  updateAddress: async (addressId, addressData) => {
    const response = await axiosInstance.put(
      `/auth/addresses/${addressId}`,
      addressData,
    );
    return response.data;
  },

  deleteAddress: async (addressId) => {
    const response = await axiosInstance.delete(`/auth/addresses/${addressId}`);
    return response.data;
  },

  setDefaultAddress: async (addressId) => {
    const response = await axiosInstance.patch(
      `/auth/addresses/${addressId}/default`,
    );
    return response.data;
  },

  upsertDefaultAddress: async (addressData) => {
    const response = await axiosInstance.put(
      "/auth/addresses/default",
      addressData,
    );
    return response.data;
  },

  getNotifications: async (limit = 30) => {
    const response = await axiosInstance.get("/auth/notifications", {
      params: { limit },
    });
    return response.data;
  },

  getNotificationsUnreadCount: async () => {
    const response = await axiosInstance.get("/auth/notifications/unread-count");
    return response.data;
  },

  markNotificationRead: async (notificationId) => {
    const response = await axiosInstance.patch(
      `/auth/notifications/${notificationId}/read`,
    );
    return response.data;
  },

  markAllNotificationsRead: async () => {
    const response = await axiosInstance.patch("/auth/notifications/read-all");
    return response.data;
  },

  deleteNotification: async (notificationId) => {
    const response = await axiosInstance.delete(
      `/auth/notifications/${notificationId}`,
    );
    return response.data;
  },

  clearNotifications: async ({ readOnly = false } = {}) => {
    const response = await axiosInstance.delete("/auth/notifications", {
      params: readOnly ? { read: "true" } : {},
    });
    return response.data;
  },

  getNotificationSettings: async () => {
    const response = await axiosInstance.get("/auth/notifications/settings");
    return response.data;
  },

  updateNotificationSettings: async (settings) => {
    const response = await axiosInstance.put("/auth/notifications/settings", settings);
    return response.data;
  },
};

export const profileSecurityAPI = {
  changePassword: async (payload) => {
    const response = await axiosInstance.put("/profile/change-password", payload);
    return response.data;
  },

  getLoginHistory: async () => {
    const response = await axiosInstance.get("/profile/login-history");
    return response.data;
  },

  getActiveSessions: async () => {
    const response = await axiosInstance.get("/profile/active-sessions");
    return response.data;
  },

  logoutDevice: async (sessionId) => {
    const response = await axiosInstance.post(`/profile/logout-device/${sessionId}`);
    return response.data;
  },

  logoutAllOtherDevices: async () => {
    const response = await axiosInstance.post("/profile/logout-all-other-devices");
    return response.data;
  },

  deleteAccount: async (payload) => {
    const response = await axiosInstance.delete("/profile/delete-account", {
      data: payload,
    });
    return response.data;
  },
};

export const settingsAPI = {
  getPublicSettings: async () => {
    const response = await axiosInstance.get("/settings");
    return response.data;
  },
  getWhatsAppNumber: async () => {
    const response = await axiosInstance.get("/settings/whatsapp");
    return response.data;
  },
  getExchangeRates: async (currencies = []) => {
    const params = Array.isArray(currencies) && currencies.length
      ? { currencies: currencies.join(",") }
      : undefined;
    const response = await axiosInstance.get("/settings/rates", { params });
    return response.data;
  },
};

export const announcementAPI = {
  getActive: async () => {
    const response = await axiosInstance.get("/announcements/active");
    return response.data;
  },

  getAll: async () => {
    const response = await axiosInstance.get("/announcements");
    return response.data;
  },

  create: async (data) => {
    const response = await axiosInstance.post("/announcements", data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await axiosInstance.put(`/announcements/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await axiosInstance.delete(`/announcements/${id}`);
    return response.data;
  },
};

export const teamAPI = {
  getAll: async () => {
    const response = await axiosInstance.get("/team/all");
    return response.data;
  },

  getActive: async () => {
    const response = await axiosInstance.get("/team");
    return response.data;
  },

  create: async (data) => {
    const response = await axiosInstance.post("/team", data);
    return response.data;
  },

  update: async (id, data) => {
    const response = await axiosInstance.put(`/team/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await axiosInstance.delete(`/team/${id}`);
    return response.data;
  },

  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append("profile_image", file);
    const response = await axiosInstance.post("/team/upload-image", formData);
    return response.data;
  },
};

// Admin APIs
export const adminAPI = {
  // Super-admin gate only. Backend rejects accounts whose admin_role !== 'super_admin'.
  login: async (credentials) => {
    const response = await axiosInstance.post("/admin/login", credentials);
    if (response.data.token) {
      setAdminAccessToken(response.data.token);
      emitAuthSessionSync("admin-login");
    }
    return response.data;
  },

  // Staff gate. Backend accepts staff_admin / admin / moderator — rejects super_admin.
  // Returns the same token shape as super-admin login so the rest of the admin
  // app (shared dashboard, permissions) keeps working unchanged.
  staffLogin: async (credentials) => {
    const response = await axiosInstance.post("/admin/staff-login", credentials);
    if (response.data.token) {
      setAdminAccessToken(response.data.token);
      emitAuthSessionSync("admin-login");
    }
    return response.data;
  },

  verify: async () => {
    if (!getAdminAccessToken()) {
      return { success: false, status: 401 };
    }
    try {
      const response = await axiosInstance.get("/admin/verify");
      return response.data;
    } catch (error) {
      return {
        success: false,
        status: error?.response?.status || null,
        networkError: !error?.response,
      };
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/admin/logout");
    } catch (error) {}
    clearAdminSessionStorage();
    emitAuthSessionSync("admin-logout");
    return { success: true };
  },

  getDashboardStats: async () => {
    if (!getAdminAccessToken()) {
      return {};
    }
    const response = await axiosInstance.get("/admin/dashboard/stats");
    return response.data;
  },

  getSettings: async () => {
    const response = await axiosInstance.get("/admin/settings");
    return response.data;
  },

  updateSettings: async (settings) => {
    const response = await axiosInstance.put("/admin/settings", settings);
    return response.data;
  },

  sendTestEmail: async (email) => {
    const response = await axiosInstance.post("/admin/settings/test-email", {
      email,
    });
    return response.data;
  },

  getRecentOrders: async (limit = 10) => {
    if (!getAdminAccessToken()) {
      return [];
    }
    const response = await axiosInstance.get("/admin/dashboard/recent-orders", {
      params: { limit },
    });
    return response.data;
  },

  getSalesReport: async (params = {}) => {
    if (!getAdminAccessToken()) {
      return [];
    }
    const response = await axiosInstance.get("/admin/reports/sales", {
      params,
    });
    return response.data;
  },

  getProductSalesReport: async () => {
    if (!getAdminAccessToken()) {
      return [];
    }
    const response = await axiosInstance.get("/admin/reports/products");
    return response.data;
  },

  getCustomers: async () => {
    if (!getAdminAccessToken()) {
      return [];
    }
    const response = await axiosInstance.get("/admin/users");
    return response.data;
  },

  getUsers: async (params = {}) => {
    if (!getAdminAccessToken()) {
      return [];
    }
    const response = await axiosInstance.get("/admin/users", { params });
    return response.data;
  },

  createCustomer: async (customerData) => {
    const response = await axiosInstance.post("/admin/users", customerData);
    return response.data;
  },

  updateCustomer: async (customerId, customerData) => {
    const response = await axiosInstance.put(
      `/admin/users/${customerId}`,
      customerData,
    );
    return response.data;
  },

  updateCustomerStatus: async (customerId, isActive) => {
    const response = await axiosInstance.patch(
      `/admin/users/${customerId}/status`,
      {
        is_active: isActive,
      },
    );
    return response.data;
  },

  updateCustomerRole: async (customerId, role) => {
    const response = await axiosInstance.put(
      `/admin/users/${customerId}/role`,
      { role },
    );
    return response.data;
  },

  deleteCustomer: async (customerId) => {
    const response = await axiosInstance.delete(`/admin/users/${customerId}`);
    return response.data;
  },

  getCoupons: async () => {
    if (!getAdminAccessToken()) {
      return [];
    }
    const response = await axiosInstance.get("/coupons");
    return response.data;
  },

  createCoupon: async (couponData) => {
    const response = await axiosInstance.post("/coupons", couponData);
    return response.data;
  },

  updateCoupon: async (id, couponData) => {
    const response = await axiosInstance.put(`/coupons/${id}`, couponData);
    return response.data;
  },

  deleteCoupon: async (id) => {
    const response = await axiosInstance.delete(`/coupons/${id}`);
    return response.data;
  },

  toggleCouponStatus: async (id) => {
    const response = await axiosInstance.patch(`/coupons/${id}/toggle`);
    return response.data;
  },

  // Shipping Cities Management
  getShippingCities: async () => {
    const response = await axiosInstance.get("/admin/shipping/city-fees");
    return response.data;
  },

  createShippingCity: async (cityData) => {
    const response = await axiosInstance.post("/admin/shipping/city-fees", cityData);
    return response.data;
  },

  updateShippingCity: async (id, cityData) => {
    const response = await axiosInstance.put(`/admin/shipping/city-fees/${id}`, cityData);
    return response.data;
  },

  deleteShippingCity: async (id) => {
    const response = await axiosInstance.delete(`/admin/shipping/city-fees/${id}`);
    return response.data;
  },

  getInventoryMovements: async (params = {}) => {
    const response = await axiosInstance.get("/admin/inventory/movements", {
      params,
    });
    return response.data;
  },

  getTaxRates: async () => {
    const response = await axiosInstance.get("/admin/tax-rates");
    return response.data;
  },

  createTaxRate: async (taxRateData) => {
    const response = await axiosInstance.post("/admin/tax-rates", taxRateData);
    return response.data;
  },

  updateTaxRate: async (taxRateId, taxRateData) => {
    const response = await axiosInstance.put(
      `/admin/tax-rates/${taxRateId}`,
      taxRateData,
    );
    return response.data;
  },

  deleteTaxRate: async (taxRateId) => {
    const response = await axiosInstance.delete(
      `/admin/tax-rates/${taxRateId}`,
    );
    return response.data;
  },

  getPaymentMethods: async () => {
    const response = await axiosInstance.get("/admin/payment-methods");
    return response.data;
  },

  createPaymentMethod: async (paymentMethodData) => {
    const response = await axiosInstance.post(
      "/admin/payment-methods",
      paymentMethodData,
    );
    return response.data;
  },

  updatePaymentMethod: async (paymentMethodId, paymentMethodData) => {
    const response = await axiosInstance.put(
      `/admin/payment-methods/${paymentMethodId}`,
      paymentMethodData,
    );
    return response.data;
  },

  deletePaymentMethod: async (paymentMethodId) => {
    const response = await axiosInstance.delete(
      `/admin/payment-methods/${paymentMethodId}`,
    );
    return response.data;
  },

  getPaymentAccounts: async () => {
    const response = await axiosInstance.get("/admin/payments/accounts");
    return response.data;
  },

  updatePaymentAccount: async (accountId, payload) => {
    const response = await axiosInstance.put(
      `/admin/payments/accounts/${accountId}`,
      payload,
    );
    return response.data;
  },

  getPaymentVerifications: async (status = "pending", stage = null) => {
    const params = { status };
    if (stage) params.stage = stage;
    const response = await axiosInstance.get(
      "/admin/payments/verifications",
      { params },
    );
    return response.data;
  },

  getPaymentAnalytics: async () => {
    const response = await axiosInstance.get("/admin/payments/analytics");
    return response.data;
  },

  approvePaymentVerification: async (verificationId, adminNote = null) => {
    const body = adminNote ? { admin_note: adminNote } : {};
    const response = await axiosInstance.put(
      `/admin/payments/verifications/${verificationId}/approve`,
      body,
    );
    return response.data;
  },

  rejectPaymentVerification: async (verificationId, reason) => {
    const response = await axiosInstance.put(
      `/admin/payments/verifications/${verificationId}/reject`,
      { reason },
    );
    return response.data;
  },

  getReturns: async (params = {}) => {
    const response = await axiosInstance.get("/admin/returns", { params });
    return response.data;
  },

  getReviews: async (params = {}) => {
    if (!getAdminAccessToken()) {
      return [];
    }
    const response = await axiosInstance.get("/admin/reviews", { params });
    return response.data;
  },

  updateReviewApproval: async (reviewId, isApproved) => {
    const response = await axiosInstance.patch(
      `/admin/reviews/${reviewId}/approval`,
      {
        is_approved: isApproved,
      },
    );
    return response.data;
  },

  deleteReview: async (reviewId) => {
    const response = await axiosInstance.delete(`/admin/reviews/${reviewId}`);
    return response.data;
  },

  updateReturnStatus: async (returnRequestId, payload) => {
    const response = await axiosInstance.put(
      `/admin/returns/${returnRequestId}/status`,
      payload,
    );
    return response.data;
  },

  // Admin Management APIs
  getAdmins: async (params = {}) => {
    const response = await axiosInstance.get("/admin-management/admins", { params });
    return response.data;
  },

  createAdmin: async (formData) => {
    const response = await axiosInstance.post("/admin-management/admins", formData);
    return response.data;
  },

  updateAdminStatus: async (adminId, status) => {
    const response = await axiosInstance.patch(
      `/admin-management/admins/${adminId}/status`,
      { status }
    );
    return response.data;
  },

  updateAdminRole: async (adminId, role, permissions) => {
    const response = await axiosInstance.patch(
      `/admin-management/admins/${adminId}/role`,
      { role, permissions }
    );
    return response.data;
  },

  removeAdminRole: async (adminId) => {
    const response = await axiosInstance.delete(
      `/admin-management/admins/${adminId}/role`
    );
    return response.data;
  },

  updateAdminProfileImage: async (adminId, file) => {
    const formData = new FormData();
    formData.append("profile_image", file);
    const response = await axiosInstance.post(
      `/admin-management/admins/${adminId}/profile-image`,
      formData,
    );
    return response.data;
  },

  removeAdminProfileImage: async (adminId) => {
    const response = await axiosInstance.delete(
      `/admin-management/admins/${adminId}/profile-image`,
    );
    return response.data;
  },

  getAdminLogs: async (adminId, limit = 20) => {
    const response = await axiosInstance.get(
      `/admin-management/admins/${adminId}/logs`,
      { params: { limit } }
    );
    return response.data;
  },

  changePassword: async (adminId, passwordData) => {
    const response = await axiosInstance.patch(
      `/admin-management/admins/${adminId}/change-password`,
      passwordData
    );
    return response.data;
  },

  resetPassword: async (adminId) => {
    const response = await axiosInstance.post(
      `/admin-management/admins/${adminId}/reset-password`
    );
    return response.data;
  },

  // Get QR code data for a product
  getProductQrData: async (productId) => {
    const response = await axiosInstance.get(`/admin/products/${productId}/qr-data`);
    return response.data;
  },

  // Admin notification methods (use same endpoints but with admin token)
  getNotifications: async (limit = 30) => {
    const response = await axiosInstance.get("/auth/notifications", {
      params: { limit },
    });
    return response.data;
  },

  markNotificationRead: async (notificationId) => {
    const response = await axiosInstance.patch(
      `/auth/notifications/${notificationId}/read`,
    );
    return response.data;
  },

  markAllNotificationsRead: async () => {
    const response = await axiosInstance.patch("/auth/notifications/read-all");
    return response.data;
  },

  deleteNotification: async (notificationId) => {
    const response = await axiosInstance.delete(
      `/auth/notifications/${notificationId}`,
    );
    return response.data;
  },

  clearNotifications: async ({ readOnly = false } = {}) => {
    const response = await axiosInstance.delete("/auth/notifications", {
      params: readOnly ? { read: "true" } : {},
    });
    return response.data;
  },

  getNotificationSettings: async () => {
    const response = await axiosInstance.get("/auth/notifications/settings");
    return response.data;
  },

  updateNotificationSettings: async (settings) => {
    const response = await axiosInstance.put("/auth/notifications/settings", settings);
    return response.data;
  },
};

// Payment verification APIs
export const paymentAPI = {
  getActiveAccounts: async () => {
    const response = await axiosInstance.get("/payments/accounts/active");
    return response.data;
  },

  submitVerification: async (formData) => {
    const response = await axiosInstance.post(
      "/payments/submit-verification",
      formData,
    );
    return response.data;
  },
};

// Order APIs
export const orderAPI = {
  getAll: async () => {
    const hasAdminToken = !!getAdminAccessToken();
    const userToken = getUserAccessToken();
    if (!hasAdminToken && !userToken) {
      return [];
    }
    const endpoint = hasAdminToken ? "/orders/admin/all" : "/orders/my-orders";
    const response = await axiosInstance.get(endpoint);
    return response.data;
  },

  getById: async (id) => {
    const response = await axiosInstance.get(`/orders/${id}`);
    return response.data;
  },

  getUserOrders: async (userId) => {
    const userToken = getUserAccessToken();
    if (!userToken) {
      return [];
    }
    const response = await axiosInstance.get("/orders/my-orders");
    return response.data;
  },

  create: async (orderData) => {
    const userToken = getUserAccessToken();
    if (!userToken) {
      const err = new Error("Please login to place your order");
      err.status = 401;
      throw err;
    }
    const response = await axiosInstance.post("/orders/create", orderData);
    return response.data;
  },

  updateStatus: async (id, status, paymentStatus = null, extra = {}) => {
    const payload = {
      status,
      ...extra,
    };
    if (paymentStatus !== null && paymentStatus !== undefined) {
      payload.payment_status = paymentStatus;
    }
    const response = await axiosInstance.put(`/orders/${id}/status`, payload);
    return response.data;
  },

  cancel: async (id) => {
    const response = await axiosInstance.put(`/orders/${id}/cancel`);
    return response.data;
  },

  downloadInvoice: async function downloadInvoiceFn(id, retryCount = 1) {
    const fallbackFilename = `ord-${String(id).padStart(6, "0")}-invoice.pdf`;

    try {
      const response = await axiosInstance.get(`/orders/${id}/invoice`, {
        responseType: "blob",
        timeout: INVOICE_DOWNLOAD_TIMEOUT_MS,
        headers: {
          Accept: "application/pdf",
          "X-Skip-Auth-Refresh": "true",
        },
      });

      const contentType = String(
        response.headers["content-type"] || "application/pdf",
      );
      const blob = normalizePdfBlob(response.data, contentType);

      const filename = getFilenameFromContentDisposition(
        response.headers["content-disposition"],
        fallbackFilename,
      );

      return {
        blob,
        filename,
        status: response.status,
        contentType,
      };
    } catch (error) {
      const xhr = error?.request;
      const rawPayload = xhr?.response;
      const xhrContentType = String(
        xhr?.getResponseHeader?.("Content-Type") || "application/pdf",
      );
      const xhrDisposition = xhr?.getResponseHeader?.("Content-Disposition");
      const looksLikeFalseNetworkError =
        /network error/i.test(String(error?.message || "")) &&
        hasDownloadablePayload(rawPayload);

      // Some browsers report a false Network Error for attachment/blob requests
      // even when the PDF payload is available on the underlying XHR object.
      if (looksLikeFalseNetworkError) {
        return {
          blob: normalizePdfBlob(rawPayload, xhrContentType),
          filename: getFilenameFromContentDisposition(
            xhrDisposition,
            fallbackFilename,
          ),
          status: Number(xhr?.status) || 200,
          contentType: xhrContentType,
        };
      }

      // Retry once on network error. The browser may report a false Network
      // Error for blob requests where the XHR response was cleared before
      // the error handler ran (making the recovery path above unreachable).
      if (
        retryCount > 0 &&
        /network error/i.test(String(error?.message || ""))
      ) {
        return downloadInvoiceFn(id, 0);
      }

      throw error;
    }
  },

  getStatusHistory: async (id) => {
    const response = await axiosInstance.get(`/orders/${id}/history`);
    return response.data;
  },

  getShipment: async (id) => {
    const response = await axiosInstance.get(`/orders/${id}/shipment`);
    return response.data;
  },

  updateShipment: async (id, shipmentData) => {
    const response = await axiosInstance.put(
      `/orders/${id}/shipment`,
      shipmentData,
    );
    return response.data;
  },

  delete: async (id) => {
    const response = await axiosInstance.delete(`/orders/${id}`);
    return response.data;
  },

  validateCoupon: async (code, orderAmount) => {
    const response = await axiosInstance.post("/coupons/validate", {
      code,
      orderAmount,
    });
    return response.data;
  },
};

// Return APIs
export const returnAPI = {
  createRequest: async (payload) => {
    const response = await axiosInstance.post("/returns/request", payload);
    return response.data;
  },

  getMyReturns: async () => {
    const response = await axiosInstance.get("/returns/my");
    return response.data;
  },

  getById: async (returnRequestId) => {
    const response = await axiosInstance.get(`/returns/${returnRequestId}`);
    return response.data;
  },

  getAdminAll: async (params = {}) => {
    const response = await axiosInstance.get("/returns/admin/all", { params });
    return response.data;
  },
};

// Category APIs
export const categoryAPI = {
  getAll: async (params = {}) => {
    const response = await axiosInstance.get("/categories", { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await axiosInstance.get(`/categories/${id}`);
    return response.data;
  },

  create: async (categoryData) => {
    const response = await axiosInstance.post("/categories", categoryData);
    return response.data;
  },

  update: async (id, categoryData) => {
    const response = await axiosInstance.put(`/categories/${id}`, categoryData);
    return response.data;
  },

  delete: async (id) => {
    const response = await axiosInstance.delete(`/categories/${id}`);
    return response.data;
  },

  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append("category_image", file);
    const response = await axiosInstance.post("/categories/upload-image", formData);
    return response.data;
  },
};

// Geolocation APIs
export const geolocationAPI = {
  getCurrency: async () => {
    try {
      const response = await axiosInstance.get("/geolocation/currency");
      return response.data;
    } catch {
      return { country_code: 'PK', currency: 'PKR', source: 'fallback' };
    }
  },

  getInfo: async () => {
    const response = await axiosInstance.get("/geolocation/info");
    return response.data;
  },
};

// Contact APIs
export const contactAPI = {
  sendMessage: async (messageData) => {
    const response = await axiosInstance.post("/contact", messageData);
    return response.data;
  },

  getAll: async (params = {}) => {
    const response = await axiosInstance.get("/contact", { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await axiosInstance.get(`/contact/${id}`);
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await axiosInstance.put(`/contact/${id}/status`, {
      status,
    });
    return response.data;
  },

  delete: async (id) => {
    const response = await axiosInstance.delete(`/contact/${id}`);
    return response.data;
  },
};

// Cart APIs
export const cartAPI = {
  get: async () => {
    const response = await axiosInstance.get("/cart");
    return response.data;
  },

  add: async (productId, quantity) => {
    const response = await axiosInstance.post("/cart/add", {
      product_id: productId,
      quantity,
    });
    return response.data;
  },

  update: async (productId, quantity) => {
    const response = await axiosInstance.put(`/cart/update/${productId}`, {
      quantity,
    });
    return response.data;
  },

  remove: async (productId) => {
    const response = await axiosInstance.delete(`/cart/remove/${productId}`);
    return response.data;
  },

  clear: async () => {
    const response = await axiosInstance.delete("/cart/clear");
    return response.data;
  },
};

// Wishlist APIs
export const wishlistAPI = {
  get: async () => {
    const response = await axiosInstance.get("/wishlist");
    return response.data;
  },

  add: async (productId) => {
    const response = await axiosInstance.post("/wishlist/add", {
      product_id: productId,
    });
    return response.data;
  },

  remove: async (productId) => {
    const response = await axiosInstance.delete(`/wishlist/${productId}`);
    return response.data;
  },

  removeByProduct: async (productId) => {
    const response = await axiosInstance.delete(
      `/wishlist/remove/${productId}`,
    );
    return response.data;
  },

  check: async (productId) => {
    const response = await axiosInstance.get(`/wishlist/check/${productId}`);
    return response.data;
  },

  clear: async () => {
    const response = await axiosInstance.delete("/wishlist");
    return response.data;
  },
};

// Reviews API (for customers to submit reviews)
export const reviewAPI = {
  // Submit a review for a product
  submitReview: async (reviewData) => {
    const response = await axiosInstance.post("/reviews", reviewData);
    return response.data;
  },

  // Get reviews for a specific product (approved only)
  getProductReviews: async (productId) => {
    const response = await axiosInstance.get(`/reviews/product/${productId}`);
    return response.data;
  },

  // Get current user's reviews
  getMyReviews: async () => {
    const response = await axiosInstance.get("/reviews/my-reviews");
    return response.data;
  },
};

// Newsletter API — public subscribe + admin-only management
export const newsletterAPI = {
  subscribe: async (email, source = "footer") => {
    const response = await axiosInstance.post("/newsletter/subscribe", {
      email,
      source,
    });
    return response.data;
  },

  // Admin endpoints
  listSubscribers: async (params = {}) => {
    const response = await axiosInstance.get("/admin/newsletter/subscribers", {
      params,
    });
    return response.data;
  },

  deleteSubscriber: async (id) => {
    const response = await axiosInstance.delete(
      `/admin/newsletter/subscribers/${id}`,
    );
    return response.data;
  },

  broadcast: async ({ subject, message }) => {
    const response = await axiosInstance.post("/admin/newsletter/broadcast", {
      subject,
      message,
    });
    return response.data;
  },

  setWelcomePromo: async (code) => {
    const response = await axiosInstance.post("/admin/newsletter/welcome-promo", {
      code,
    });
    return response.data;
  },
};

export default {
  productAPI,
  userAPI,
  profileSecurityAPI,
  adminAPI,
  orderAPI,
  categoryAPI,
  announcementAPI,
  geolocationAPI,
  contactAPI,
  cartAPI,
  wishlistAPI,
  returnAPI,
  reviewAPI,
  newsletterAPI,
  axiosInstance,
  emitAuthSessionSync,
};
