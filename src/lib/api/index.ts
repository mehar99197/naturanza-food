/**
 * The single import point for the API layer.
 *
 * Ported from `frontend/src/services/api.js`, which the Vite app still uses.
 * The exported names are unchanged so a component moving from the SPA to Next
 * only swaps its import path, and the HTTP contract — every endpoint, method,
 * body, header, cookie and retry — is unchanged with them.
 *
 * These are client modules. They read `window`, hold the access token in memory
 * and must not be imported from a Server Component; there is deliberately no
 * `server-only` marker, because the consumers are `"use client"` files.
 *
 * One implementation detail differs from the original: the transport is
 * `fetch`, not axios (axios is not a dependency of the Next app). Everything
 * axios did on the way out — parameter encoding, `transformRequest`, the
 * `Accept` default, `withCredentials`, `validateStatus`, timeout-to-
 * `ECONNABORTED` — is reproduced in `serialize.ts` and `http.ts`.
 */

// Transport and session plumbing
export { apiClient, refreshUserAccessToken } from "./client";
export {
  CSRF_HEADER_NAME,
  DEFAULT_TIMEOUT_MS,
  INVOICE_DOWNLOAD_TIMEOUT_MS,
  SKIP_AUTH_REFRESH_HEADER,
  getApiBaseUrl,
  resolveApiBaseUrl,
} from "./config";
export {
  ApiError,
  CSRF_USER_MESSAGE,
  errorCodeOf,
  isApiError,
  isRecord,
  statusOf,
} from "./errors";
export type { ApiErrorResponse } from "./errors";
export { ensureCsrfToken, getCachedCsrfToken, resetCsrfToken } from "./csrf";
export {
  AUTH_SESSION_SYNC_EVENT,
  clearAdminAccessToken,
  clearUserAccessToken,
  emitAuthSessionSync,
  getAdminAccessToken,
  getUserAccessToken,
  hasUserSession,
  setAdminAccessToken,
  setUserAccessToken,
} from "./session";
export type { AuthSessionSyncDetail } from "./session";

export type {
  AccessTokenResponse,
  AdminVerifyFailure,
  ApiResponse,
  ApiResponseType,
  AuthScope,
  CsrfTokenResponse,
  HttpMethod,
  InvoiceDownload,
  JsonBody,
  PaginatedResult,
  QueryParamValue,
  QueryParams,
  RequestBody,
  RequestConfig,
  RequestOptions,
  RequestState,
  ResponseHeaders,
} from "./types";

// Resource modules
export { aboutAPI } from "./about";
export { adminAPI } from "./admin";
export { adminSecurityAPI } from "./admin-security";
export { announcementAPI } from "./announcements";
export { userAPI } from "./auth";
export type { VerifyEmailPayload } from "./auth";
export { blogAPI } from "./blog";
export { cartAPI } from "./cart";
export { categoryAPI } from "./categories";
export { contactAPI } from "./contact";
export { geolocationAPI } from "./geolocation";
export type { GeolocationCurrency } from "./geolocation";
export { newsletterAPI } from "./newsletter";
export { orderAPI } from "./orders";
export type { AdminOrderPageParams } from "./orders";
export { paymentAPI } from "./payments";
export { productAPI } from "./products";
export { profileSecurityAPI } from "./profile";
export { returnAPI } from "./returns";
export { reviewAPI } from "./reviews";
export { settingsAPI } from "./settings";
export { teamAPI } from "./team";
export { wishlistAPI } from "./wishlist";

import { aboutAPI } from "./about";
import { adminAPI } from "./admin";
import { adminSecurityAPI } from "./admin-security";
import { announcementAPI } from "./announcements";
import { userAPI } from "./auth";
import { blogAPI } from "./blog";
import { cartAPI } from "./cart";
import { categoryAPI } from "./categories";
import { apiClient } from "./client";
import { contactAPI } from "./contact";
import { emitAuthSessionSync } from "./session";
import { geolocationAPI } from "./geolocation";
import { newsletterAPI } from "./newsletter";
import { orderAPI } from "./orders";
import { paymentAPI } from "./payments";
import { productAPI } from "./products";
import { profileSecurityAPI } from "./profile";
import { returnAPI } from "./returns";
import { reviewAPI } from "./reviews";
import { settingsAPI } from "./settings";
import { teamAPI } from "./team";
import { wishlistAPI } from "./wishlist";

/**
 * Mirrors the source's default export. `apiClient` stands in for the exported
 * `axiosInstance`; nothing else about the shape changed.
 */
const api = {
  productAPI,
  userAPI,
  profileSecurityAPI,
  adminSecurityAPI,
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
  settingsAPI,
  teamAPI,
  aboutAPI,
  blogAPI,
  paymentAPI,
  apiClient,
  emitAuthSessionSync,
};

export default api;
