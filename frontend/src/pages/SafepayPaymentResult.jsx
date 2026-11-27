import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Receipt,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import { paymentAPI } from "@/services/api";
import { useCart } from "@/context/CartContext";
import { useOrders } from "@/context/OrderContext";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice } from "@/lib/utils";
import { NoIndexSEO } from "@/components/SEO";

export function SafepayPaymentResult({ mode = "result" }) {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const { fetchOrders } = useOrders();
  const { settings } = useSettings();
  const storeName = settings.storeName || "Naturanza Food";

  const orderIdParam = Number.parseInt(searchParams.get("order_id") || "", 10);
  const trackerParam = (
    searchParams.get("tracker") ||
    searchParams.get("beacon") ||
    ""
  ).trim();

  const [status, setStatus] = useState(mode === "cancel" ? "cancelled" : "verifying");
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [retrying, setRetrying] = useState(false);

  const verifyPayment = useCallback(async () => {
    if (!Number.isInteger(orderIdParam) || orderIdParam <= 0) {
      setStatus("error");
      setErrorMessage("Missing order reference in payment return URL.");
      return;
    }

    setStatus("verifying");
    setErrorMessage("");

    try {
      const data = await paymentAPI.verifySafepay({
        order_id: orderIdParam,
        tracker: trackerParam || undefined,
      });

      if (data?.verified) {
        setResult(data);
        setStatus("success");
        clearCart();
        void fetchOrders();
      } else {
        setResult(data);
        setStatus("pending");
        setErrorMessage(
          data?.message || "Your SafePay payment is not yet confirmed.",
        );
      }
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err?.response?.data?.error ||
          err?.message ||
          "Unable to verify your SafePay payment right now.",
      );
    }
  }, [clearCart, fetchOrders, orderIdParam, trackerParam]);

  useEffect(() => {
    if (mode === "cancel") {
      if (Number.isInteger(orderIdParam) && orderIdParam > 0) {
        void paymentAPI
          .cancelSafepay({
            order_id: orderIdParam,
            tracker: trackerParam || undefined,
          })
          .catch(() => {});
      }
      return;
    }

    void verifyPayment();
  }, [mode, orderIdParam, trackerParam, verifyPayment]);

  const handleRetrySafepay = async () => {
    if (!Number.isInteger(orderIdParam) || orderIdParam <= 0 || retrying) {
      return;
    }

    setRetrying(true);
    setErrorMessage("");
    try {
      const session = await paymentAPI.createSafepaySession(orderIdParam);
      if (!session?.checkout_url) {
        throw new Error("SafePay did not return a checkout link.");
      }
      window.location.assign(session.checkout_url);
    } catch (err) {
      setErrorMessage(
        err?.response?.data?.error ||
          err?.message ||
          "Failed to start a new SafePay payment session.",
      );
      setRetrying(false);
    }
  };

  const orderNumber =
    result?.order_number ||
    (Number.isInteger(orderIdParam) && orderIdParam > 0
      ? `ORD-${String(orderIdParam).padStart(6, "0")}`
      : "");

  return (
    <>
      <NoIndexSEO title={`SafePay Payment Status - ${storeName}`} />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf5_0%,_#f8fafc_38%,_#faf8f3_100%)] pt-24 sm:pt-28 pb-16 px-4">
        <div className="container-custom max-w-2xl">
          <div className="rounded-3xl border border-white/70 bg-white/95 p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.1)] backdrop-blur sm:p-10">
            {status === "verifying" && (
              <>
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
                <h1 className="font-display text-2xl font-bold text-slate-900">
                  Verifying SafePay Payment...
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Please wait while we confirm your transaction with SafePay.
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
                  <CheckCircle2 className="h-11 w-11" />
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                  Payment Confirmed!
                </h1>
                <p className="mt-2 text-sm sm:text-base text-slate-600">
                  {result?.stage === "advance_shipping"
                    ? "Your delivery fee advance was verified via SafePay and your COD order is confirmed."
                    : "Your online payment was verified via SafePay and your order is confirmed."}
                </p>

                <div className="my-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-5 text-left">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-slate-500">Order Number</p>
                      <p className="text-base font-bold text-slate-900">{orderNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Payment Gateway</p>
                      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                        <Shield className="h-4 w-4" />
                        SafePay
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Amount Paid Now</p>
                      <p className="text-lg font-bold text-emerald-700">
                        {formatPrice(Number(result?.amount_paid || 0), settings.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Order Total</p>
                      <p className="text-base font-semibold text-slate-900">
                        {formatPrice(Number(result?.total_amount || 0), settings.currency)}
                      </p>
                    </div>
                    {Number(result?.remaining_cod || 0) > 0 && (
                      <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5">
                        <p className="text-xs font-medium text-amber-800">
                          Remaining Cash on Delivery Balance:{" "}
                          <span className="font-bold">
                            {formatPrice(Number(result.remaining_cod), settings.currency)}
                          </span>
                        </p>
                      </div>
                    )}
                    {result?.tracker && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-slate-500">SafePay Reference</p>
                        <p className="break-all font-mono text-xs font-semibold text-slate-700">
                          {result.tracker}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/orders"
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-600 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:from-emerald-600 hover:to-green-700"
                  >
                    <Receipt className="h-4 w-4" />
                    View My Orders
                  </Link>
                  <Link
                    to="/shop"
                    className="flex h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Continue Shopping
                  </Link>
                </div>
              </>
            )}

            {status === "pending" && (
              <>
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Clock className="h-10 w-10" />
                </div>
                <h1 className="font-display text-2xl font-bold text-slate-900">
                  Payment Confirmation Pending
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  {errorMessage || "SafePay has not finalized this transaction yet."}
                </p>
                {orderNumber && (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Order: {orderNumber}
                  </p>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void verifyPayment()}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Check Status Again
                  </button>
                  <button
                    type="button"
                    onClick={handleRetrySafepay}
                    disabled={retrying}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-600 px-5 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
                  >
                    {retrying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Retry SafePay Payment
                  </button>
                </div>
              </>
            )}

            {(status === "cancelled" || status === "error") && (
              <>
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  {status === "cancelled" ? (
                    <XCircle className="h-10 w-10" />
                  ) : (
                    <AlertCircle className="h-10 w-10" />
                  )}
                </div>
                <h1 className="font-display text-2xl font-bold text-slate-900">
                  {status === "cancelled" ? "SafePay Payment Cancelled" : "Payment Verification Failed"}
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  {errorMessage ||
                    "You cancelled the SafePay checkout session. Your order is still saved and you can retry payment anytime."}
                </p>
                {orderNumber && (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Order: {orderNumber}
                  </p>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  {Number.isInteger(orderIdParam) && orderIdParam > 0 && (
                    <button
                      type="button"
                      onClick={handleRetrySafepay}
                      disabled={retrying}
                      className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-600 px-5 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
                    >
                      {retrying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      Retry SafePay Payment
                    </button>
                  )}
                  <Link
                    to="/orders"
                    className="flex h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View My Orders
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export default SafepayPaymentResult;
