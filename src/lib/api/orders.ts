/**
 * Order endpoints, including the invoice download and coupon validation that
 * the source keeps on `orderAPI` rather than with the coupons.
 */

import { apiClient } from "./client";
import { INVOICE_DOWNLOAD_TIMEOUT_MS } from "./config";
import { ApiError } from "./errors";
import { getFilenameFromContentDisposition, normalizePdfBlob } from "./invoice";
import { asCount, asList } from "./payload";
import { getAdminAccessToken, getUserAccessToken } from "./session";
import type { InvoiceDownload, PaginatedResult, RequestBody } from "./types";

export interface AdminOrderPageParams {
  limit?: number;
  offset?: number;
  status?: string | null;
  search?: string;
}

/**
 * GET /orders/:id/invoice as a PDF blob.
 *
 * Retries once on a transport failure, because a long-running PDF render is
 * the request most likely to be dropped by an intermediary. It carries
 * `X-Skip-Auth-Refresh` so a 401 cannot turn one 120-second request into two.
 */
const downloadInvoice = async (
  id: string | number,
  retryCount = 1,
): Promise<InvoiceDownload> => {
  const fallbackFilename = `ord-${String(id).padStart(6, "0")}-invoice.pdf`;

  try {
    const response = await apiClient.request<Blob>({
      url: `/orders/${id}/invoice`,
      method: "GET",
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

    return {
      blob: normalizePdfBlob(response.data, contentType),
      filename: getFilenameFromContentDisposition(
        response.headers["content-disposition"],
        fallbackFilename,
      ),
      status: response.status,
      contentType,
    };
  } catch (error) {
    // The source also salvaged a payload off `error.request` here, because XHR
    // reports a false "Network Error" for some attachment responses while still
    // holding the bytes. `fetch` has no such failure mode — it either resolves
    // with a Response or rejects with nothing to salvage — so only the retry,
    // which is a real second request, carries over.
    if (
      retryCount > 0 &&
      /network error/i.test(String(error instanceof Error ? error.message : ""))
    ) {
      return downloadInvoice(id, 0);
    }
    throw error;
  }
};

export const orderAPI = {
  /**
   * GET /orders/my-orders — inherently bounded, one request.
   *
   * Resolves to `[]` without touching the network when there is no session,
   * and otherwise passes the server payload through untouched.
   */
  getAll: async <T = unknown>(): Promise<T> => {
    if (!getUserAccessToken()) {
      return [] as T;
    }
    return apiClient.get<T>("/orders/my-orders");
  },

  /**
   * GET /orders/admin/all — one page, with the matching total for the pager.
   *
   * This replaced a loop that walked up to 100 pages of 500 to pull every order
   * the store had ever taken into browser memory on each visit — cost grew with
   * the order table forever. Status and search are applied server-side, because
   * filtering in the browser only works if the browser holds every row.
   */
  getAdminPage: async <T = unknown>({
    limit = 25,
    offset = 0,
    status = null,
    search = "",
  }: AdminOrderPageParams = {}): Promise<PaginatedResult<T>> => {
    if (!getAdminAccessToken()) {
      return { data: [], total: 0 };
    }
    const payload = await apiClient.get<unknown>("/orders/admin/all", {
      params: {
        limit,
        offset,
        ...(status && status !== "all" ? { status } : {}),
        ...(search ? { search } : {}),
      },
    });
    if (Array.isArray(payload)) {
      // Tolerated so a browser holding a cached bundle keeps working against a
      // server that has not been redeployed yet.
      return { data: payload as T[], total: payload.length };
    }
    return { data: asList<T>(payload), total: asCount(payload, "total") };
  },

  /** GET /orders/:id */
  getById: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.get<T>(`/orders/${id}`),

  /**
   * GET /orders/my-orders.
   *
   * The `userId` argument is accepted and ignored — the server derives the
   * customer from the token. Kept in the signature because call sites pass it.
   */
  getUserOrders: async <T = unknown>(_userId?: string | number): Promise<T> => {
    if (!getUserAccessToken()) {
      return [] as T;
    }
    return apiClient.get<T>("/orders/my-orders");
  },

  /**
   * POST /orders/create.
   *
   * Fails locally with a 401-shaped error when there is no session, so checkout
   * can show the login prompt without a round-trip.
   */
  create: async <T = unknown>(orderData: RequestBody): Promise<T> => {
    if (!getUserAccessToken()) {
      // `async` matters: callers `.catch()` this, so it must reject rather
      // than throw synchronously out of the call expression.
      throw new ApiError("Please login to place your order", { status: 401 });
    }
    return apiClient.post<T>("/orders/create", orderData);
  },

  /** PUT /orders/:id/status — `payment_status` is only sent when supplied. */
  updateStatus: <T = unknown>(
    id: string | number,
    status: string,
    paymentStatus: string | null = null,
    extra: Record<string, unknown> = {},
  ): Promise<T> =>
    apiClient.put<T>(`/orders/${id}/status`, {
      status,
      ...extra,
      ...(paymentStatus !== null && paymentStatus !== undefined
        ? { payment_status: paymentStatus }
        : {}),
    }),

  /** PUT /orders/:id/cancel — no body. */
  cancel: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.put<T>(`/orders/${id}/cancel`),

  downloadInvoice,

  /** GET /orders/:id/history */
  getStatusHistory: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.get<T>(`/orders/${id}/history`),

  /** GET /orders/:id/shipment */
  getShipment: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.get<T>(`/orders/${id}/shipment`),

  /** PUT /orders/:id/shipment */
  updateShipment: <T = unknown>(
    id: string | number,
    shipmentData: RequestBody,
  ): Promise<T> => apiClient.put<T>(`/orders/${id}/shipment`, shipmentData),

  /** DELETE /orders/:id */
  delete: <T = unknown>(id: string | number): Promise<T> =>
    apiClient.delete<T>(`/orders/${id}`),

  /** POST /coupons/validate — checkout's discount check. */
  validateCoupon: <T = unknown>(code: string, orderAmount: number): Promise<T> =>
    apiClient.post<T>("/coupons/validate", { code, orderAmount }),
};
