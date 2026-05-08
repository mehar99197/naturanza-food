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
  headers: {
    "Content-Type": "application/json",
  },
});

export const AUTH_SESSION_SYNC_EVENT = "naturanza:auth-session-sync";

const ADMIN_ACCESS_TOKEN_STORAGE_KEY = "adminAccessToken";
const USER_ACCESS_TOKEN_STORAGE_KEY = "token";

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

let userAccessToken = readStoredUserAccessToken();
let adminAccessToken = readStoredAdminAccessToken();
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
  
  if (!canUseWebStorage()) {
    return;
  }

  if (userAccessToken) {
    window.localStorage.setItem(USER_ACCESS_TOKEN_STORAGE_KEY, userAccessToken);
  } else {
    window.localStorage.removeItem(USER_ACCESS_TOKEN_STORAGE_KEY);
  }
};

export const getUserAccessToken = () => userAccessToken;

export const clearUserAccessToken = () => {
  userAccessToken = null;
  
  if (!canUseWebStorage()) {
    return;
  }

  window.localStorage.removeItem(USER_ACCESS_TOKEN_STORAGE_KEY);
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

// Add token to requests
axiosInstance.interceptors.request.use((config) => {
  const adminToken = getAdminAccessToken();
  const userToken = getUserAccessToken();
  const requestUrl = String(config.url || "");
  const isUserScopedRoute =
    /^\/auth(\/|$)/.test(requestUrl) ||
    /^\/profile(\/|$)/.test(requestUrl) ||
    /^\/wishlist(\/|$)/.test(requestUrl) ||
    /^\/cart(\/|$)/.test(requestUrl) ||
    /^\/orders(\/|$)/.test(requestUrl) ||
    /^\/reviews(\/|$)/.test(requestUrl);
  const isAdminRoute =
    /^\/admin(\/|$)/.test(requestUrl) ||
    requestUrl.includes("/admin/") ||
    /^\/orders\/admin(\/|$)/.test(requestUrl);
  const isAdminPage =
    typeof window !== "undefined" &&
    /^\/admin(\/|$)/.test(String(window.location?.pathname || ""));

  let token = null;

  if (isAdminRoute || isAdminPage) {
    token = adminToken || null;
  } else if (isUserScopedRoute) {
    token = userToken || null;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }

  return config;
});

// Handle response errors
const isAdminRequestUrl = (requestUrl) =>
  /^\/admin(\/|$)/.test(requestUrl) ||
  requestUrl.includes("/admin/") ||
  /^\/orders\/admin(\/|$)/.test(requestUrl);

const isRefreshBypassRequest = (config) =>
  Boolean(
    config?.headers?.["X-Skip-Auth-Refresh"] ||
      config?.headers?.["x-skip-auth-refresh"],
  );

const isAuthBootstrapRoute = (requestUrl) =>
  /^\/auth\/(login|register|google|refresh|forgot-password|reset-password)(\/|$)/.test(
    requestUrl,
  );

const requestUserTokenRefresh = async () => {
  const response = await axiosInstance.post(
    "/auth/refresh",
    {},
    {
      headers: {
        "X-Skip-Auth-Refresh": "true",
      },
    },
  );

  const payload = response?.data || {};
  const refreshedToken = payload.accessToken || null;
  if (!refreshedToken) {
    throw new Error("Refresh endpoint did not return an access token");
  }

  setUserAccessToken(refreshedToken);
  emitAuthSessionSync("user-token-refresh");
  return payload;
};

const isUserSessionTerminalError = (error) => {
  const status = Number(error?.response?.status || 0);
  return status === 401 || status === 403;
};

const refreshUserAccessToken = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = requestUserTokenRefresh()
    .catch((error) => {
      if (isUserSessionTerminalError(error)) {
        clearUserSessionStorage();
        emitAuthSessionSync("user-token-refresh-failed");
      }
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config || {};
    const status = Number(error?.response?.status || 0);
    const requestUrl = String(originalRequest.url || "");
    const shouldAttemptRefresh =
      status === 401 &&
      !originalRequest._retry &&
      !isRefreshBypassRequest(originalRequest) &&
      !isAdminRequestUrl(requestUrl) &&
      !isAuthBootstrapRoute(requestUrl);

    if (!shouldAttemptRefresh) {
      return Promise.reject(error);
    }

    try {
      originalRequest._retry = true;
      const refreshPayload = await refreshUserAccessToken();
      const refreshedToken = refreshPayload?.accessToken || null;
      if (!refreshedToken) {
        throw new Error("Refresh endpoint did not return an access token");
      }
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
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
    const payload = await refreshUserAccessToken();
    emitAuthSessionSync("user-refresh");
    return payload;
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
    const response = await axiosInstance.post("/auth/profile/image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
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
};

// Admin APIs
export const adminAPI = {
  login: async (credentials) => {
    const response = await axiosInstance.post("/admin/login", credentials);
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
    const response = await axiosInstance.post("/admin-management/admins", formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
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

  getNotificationSettings: async () => {
    const response = await axiosInstance.get("/auth/notifications/settings");
    return response.data;
  },

  updateNotificationSettings: async (settings) => {
    const response = await axiosInstance.put("/auth/notifications/settings", settings);
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
    const response = await axiosInstance.post("/categories/upload-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
};

// Geolocation APIs
export const geolocationAPI = {
  getCurrency: async () => {
    const response = await axiosInstance.get("/geolocation/currency");
    return response.data;
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

export default {
  productAPI,
  userAPI,
  profileSecurityAPI,
  adminAPI,
  orderAPI,
  categoryAPI,
  geolocationAPI,
  contactAPI,
  cartAPI,
  wishlistAPI,
  returnAPI,
  reviewAPI,
  axiosInstance,
};
