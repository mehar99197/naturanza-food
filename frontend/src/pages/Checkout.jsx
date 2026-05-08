import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CreditCard,
  Truck,
  Shield,
  CheckCircle2,
  Tag,
  X,
  AlertCircle,
  ShoppingBag,
  Receipt,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice } from "@/lib/utils";
import api from "@/services/api";

const http = api.axiosInstance;

export function Checkout() {
  const { items, totalPrice, clearCart } = useCart();
  const { addOrder } = useOrders();
  const { user } = useAuth();
  const { settings } = useSettings();
  const [step, setStep] = useState("shipping");
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [error, setError] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [showAvailableCoupons, setShowAvailableCoupons] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  // Fetch available coupons
  useEffect(() => {
    const fetchAvailableCoupons = async () => {
      try {
        const response = await http.get("/coupons/active");
        setAvailableCoupons(response.data);
      } catch (error) {}
    };
    fetchAvailableCoupons();
  }, []);

  // Recalculate coupon discount when cart total changes
  useEffect(() => {
    if (appliedCoupon && appliedCoupon.code) {
      const revalidateCoupon = async () => {
        try {
          const response = await http.post("/coupons/validate", {
            code: appliedCoupon.code,
            orderAmount: totalPrice,
          });

          if (response.data.valid) {
            // Only update if discount amount has changed
            if (
              response.data.coupon.discount_amount !==
              appliedCoupon.discount_amount
            ) {
              setAppliedCoupon(response.data.coupon);
            }
            setCouponError("");
          } else {
            // Coupon is no longer valid
            setAppliedCoupon(null);
            setCouponError("Coupon is no longer valid for this order amount");
          }
        } catch (error) {
          // If validation fails, remove the coupon
          setAppliedCoupon(null);
          setCouponError(
            error.response?.data?.error || "Coupon validation failed",
          );
        }
      };
      revalidateCoupon();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPrice]); // Recalculate when totalPrice changes

  // Shipping form state
  const [shippingData, setShippingData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
  });
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  useEffect(() => {
    if (!user) return;

    const nameParts = String(user.name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const inferredFirstName = nameParts[0] || "";
    const inferredLastName = nameParts.slice(1).join(" ");

    setShippingData((prev) => ({
      ...prev,
      firstName:
        prev.firstName ||
        user.first_name ||
        user.firstName ||
        inferredFirstName,
      lastName:
        prev.lastName || user.last_name || user.lastName || inferredLastName,
      email: prev.email || user.email || "",
      phone: prev.phone || user.phone || user.phone_number || "",
    }));
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      setSavedAddresses([]);
      setSelectedAddressId(null);
      return;
    }

    const loadSavedAddresses = async () => {
      try {
        const response = await api.userAPI.getAddresses();
        const addresses = Array.isArray(response) ? response : [];
        setSavedAddresses(addresses);

        if (addresses.length === 0) {
          return;
        }

        const defaultAddress =
          addresses.find((address) => address.is_default) || addresses[0];
        setSelectedAddressId(defaultAddress.id);

        setShippingData((prev) => ({
          ...prev,
          firstName:
            prev.firstName ||
            String(defaultAddress.recipient_name || "")
              .split(/\s+/)
              .filter(Boolean)[0] ||
            "",
          lastName:
            prev.lastName ||
            String(defaultAddress.recipient_name || "")
              .split(/\s+/)
              .filter(Boolean)
              .slice(1)
              .join(" "),
          phone: prev.phone || defaultAddress.phone || "",
          address:
            prev.address ||
            [defaultAddress.line1, defaultAddress.line2]
              .filter(Boolean)
              .join(", "),
          city: prev.city || defaultAddress.city || "",
          postalCode: prev.postalCode || defaultAddress.postal_code || "",
        }));
      } catch (addressErr) {
        setSavedAddresses([]);
        setSelectedAddressId(null);
      }
    };

    loadSavedAddresses();
  }, [user?.id]);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [paymentData, setPaymentData] = useState({
    cardNumber: "",
    cardExpiry: "",
    cardCVC: "",
    easyPaisaNumber: "",
    jazzCashNumber: "",
  });

  const handleShippingChange = (e) => {
    const { name, value } = e.target;
    setShippingData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFullNameChange = (e) => {
    const fullNameValue = e.target.value;
    setShippingData((prev) => ({
      ...prev,
      firstName: fullNameValue,
      lastName: "",
    }));
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setPaymentData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Coupon functions
  const handleApplyCoupon = async (code = null) => {
    const couponToApply = code || couponCode.trim();

    if (!couponToApply) {
      setCouponError("Please enter a coupon code");
      return;
    }

    setIsValidatingCoupon(true);
    setCouponError("");

    try {
      const response = await http.post("/coupons/validate", {
        code: couponToApply.toUpperCase(),
        orderAmount: totalPrice,
      });

      if (response.data.valid) {
        setAppliedCoupon(response.data.coupon);
        setCouponCode("");
        setCouponError("");
        setShowAvailableCoupons(false);
      }
    } catch (error) {
      setCouponError(error.response?.data?.error || "Invalid coupon code");
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  // Calculate totals with coupon
  const subtotal = totalPrice;
  const discount = parseFloat(appliedCoupon?.discount_amount) || 0;
  const tax =
    (subtotal - discount) * (parseFloat(settings.taxRate || 18) / 100);
  const finalTotal = subtotal - discount + tax;
  const checkoutPanelClass =
    "relative overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-4 sm:p-6 lg:p-8 shadow-[0_16px_45px_rgba(15,23,42,0.08)] backdrop-blur";
  const checkoutFieldClass =
    "min-h-[48px] w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-[16px] leading-6 text-slate-800 placeholder:text-slate-400 transition-all duration-200 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:min-h-[46px] sm:py-2.5 sm:text-sm sm:leading-5";
  const checkoutPrimaryButtonToneClass =
    "bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:from-emerald-600 hover:to-green-700";
  const getPaymentOptionClass = (isActive) =>
    `grid min-h-[70px] cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border-2 p-3 transition-all duration-200 sm:gap-4 sm:p-4 ${
      isActive
        ? "border-emerald-400 bg-emerald-50/80 shadow-[0_8px_20px_rgba(16,185,129,0.16)]"
        : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
    }`;
  const isShippingStep = step === "shipping";
  const getCheckoutItemKey = (item) => item.product_id ?? item.id ?? item.name;
  const getCheckoutItemImage = (item) =>
    item.image_url || item.image || "/images/products/powder.webp";
  const getCheckoutUnitPrice = (item) => item.final_price ?? item.price;
  const customerFullName =
    `${shippingData.firstName} ${shippingData.lastName}`.trim() ||
    user?.name ||
    "Customer";

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    setError("");

    try {
      // Prepare payment details based on method
      let payment_details = {};
      if (paymentMethod === "creditCard") {
        payment_details = {
          method: "creditCard",
        };
      } else if (paymentMethod === "easypaisa") {
        payment_details = {
          method: "easypaisa",
          phoneNumber: paymentData.easyPaisaNumber,
        };
      } else if (paymentMethod === "jazzcash") {
        payment_details = {
          method: "jazzcash",
          phoneNumber: paymentData.jazzCashNumber,
        };
      } else if (paymentMethod === "cod") {
        payment_details = {
          method: "cod",
        };
      }

      let resolvedAddressId = selectedAddressId;
      if (user?.id) {
        try {
          const defaultAddressPayload = {
            label: "Checkout Default",
            recipient_name: customerFullName,
            phone: shippingData.phone,
            line1: shippingData.address,
            city: shippingData.city,
            postal_code: shippingData.postalCode,
          };

          const addressResponse = await api.userAPI.upsertDefaultAddress(
            defaultAddressPayload,
          );
          if (addressResponse?.address?.id) {
            resolvedAddressId = addressResponse.address.id;
            setSelectedAddressId(addressResponse.address.id);

            setSavedAddresses((prev) => {
              const withoutDefault = prev.map((address) => ({
                ...address,
                is_default: false,
              }));
              const nextAddress = {
                ...addressResponse.address,
                is_default: true,
              };
              const remaining = withoutDefault.filter(
                (address) => address.id !== nextAddress.id,
              );
              return [nextAddress, ...remaining];
            });
          }
        } catch (addressSaveErr) {
        }
      }

      // Prepare order data
      const orderData = {
        user_id: user?.id || null,
        address_id: resolvedAddressId,
        customer_name: customerFullName,
        customer_email: shippingData.email,
        customer_phone: shippingData.phone,
        shipping_address: `${shippingData.address}, ${shippingData.city}, ${shippingData.postalCode}`,
        city: shippingData.city,
        postal_code: shippingData.postalCode,
        payment_method: paymentMethod,
        payment_details: payment_details,
        payment_status: paymentMethod === "cod" ? "pending" : "paid",
        status: "pending",
        items: items.map((item) => ({
          product_id: item.product_id ?? item.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.final_price ?? item.price,
          image: item.image_url || item.image,
          image_url: item.image_url || item.image,
        })),
        subtotal: subtotal,
        tax: tax,
        shipping_cost: 0,
        discount_amount: discount,
        coupon_code: appliedCoupon?.code || null,
        total_amount: finalTotal,
        notes: "",
      };

      // Create order through backend API and only confirm on real DB success.
      const newOrder = await addOrder({
        user_id: orderData.user_id,
        address_id: orderData.address_id,
        shipping_address: orderData.shipping_address,
        phone: orderData.customer_phone,
        payment_method: paymentMethod,
        notes: "",
        coupon_code: orderData.coupon_code,
        discount_amount: discount,
        subtotal: subtotal,
        tax: tax,
        shipping_cost: 0,
        customer_name: orderData.customer_name,
        customer_email: orderData.customer_email,
        city: orderData.city,
        postal_code: orderData.postal_code,
        payment_details: payment_details,
        payment_status: orderData.payment_status,
        status: orderData.status,
        items: orderData.items,
        total_amount: orderData.total_amount,
      });

      const orderNum = `ORD-${newOrder.id.toString().padStart(6, "0")}`;
      setOrderNumber(orderNum);
      setStep("confirmation");
      clearCart();
    } catch (error) {
      setError(
        error.response?.data?.error ||
          "Failed to place order. Please try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (items.length === 0 && step !== "confirmation") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf5_0%,_#f8fafc_38%,_#faf8f3_100%)] pt-24 pb-16">
        <div className="container-custom max-w-xl px-4">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-8 text-center shadow-[0_20px_55px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10">
            <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-800">
              Your cart is empty
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-slate-500">
              Add your favorite Naturanza products, then come back here to
              complete checkout.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:from-emerald-600 hover:to-green-700"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (step === "confirmation") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf5_0%,_#f8fafc_38%,_#faf8f3_100%)] pt-20 pb-10 sm:pt-24 sm:pb-16">
        <div className="container-custom max-w-2xl">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.1)] backdrop-blur sm:p-8 md:p-12">
            {/* Success Icon */}
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30 sm:mb-6 sm:h-24 sm:w-24">
              <CheckCircle2 className="h-11 w-11 sm:h-14 sm:w-14" />
            </div>

            {/* Success Message */}
            <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              Order Confirmed! 🎉
            </h1>
            <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">
              Thank you for your purchase. Your order has been successfully
              placed.
            </p>

            {/* Order Details Card */}
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-4 text-left sm:mb-8 sm:p-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Order Number</p>
                  <p className="font-bold text-base sm:text-lg text-gray-900">
                    {orderNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Payment Method</p>
                  <p className="font-semibold text-sm sm:text-base text-gray-900 capitalize">
                    {paymentMethod === "cod" && "💵 Cash on Delivery"}
                    {paymentMethod === "easypaisa" && "📱 EasyPaisa"}
                    {paymentMethod === "jazzcash" && "📱 JazzCash"}
                    {paymentMethod === "creditCard" && "💳 Credit Card"}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Amount</p>
                  <p className="font-bold text-lg sm:text-xl text-green-600">
                    {formatPrice(finalTotal, settings.currency)}
                  </p>
                  {discount > 0 && (
                    <p className="text-xs text-gray-500">
                      <span className="line-through">
                        {formatPrice(subtotal + tax, settings.currency)}
                      </span>
                      <span className="text-green-600 ml-1">
                        -{formatPrice(discount, settings.currency)}
                      </span>
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Delivery To</p>
                  <p className="font-semibold text-sm sm:text-base text-gray-900">
                    {shippingData.city}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Status */}
            <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:mb-8 sm:p-4">
              <p className="text-xs sm:text-sm text-blue-900">
                📧 A confirmation email has been sent to{" "}
                <span className="font-semibold">{shippingData.email}</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                to="/shop"
                className="flex-1 py-2.5 px-5 sm:py-3 sm:px-6 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl"
              >
                Continue Shopping
              </Link>
              <button
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-gray-300 px-5 py-2.5 sm:px-6 sm:py-3 text-sm sm:text-base font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Receipt className="h-4 w-4" />
                Print Receipt
              </button>
            </div>

            {/* Help Text */}
            <p className="text-[11px] sm:text-xs text-gray-500 mt-5 sm:mt-6">
              Need help? Contact our support team at support@naturanza.com
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative w-full overflow-x-hidden bg-[radial-gradient(circle_at_top,_#ecfdf5_0%,_#f8fafc_38%,_#faf8f3_100%)] pt-[5.25rem] pb-2 sm:pt-24 sm:pb-3">
      <div className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block" aria-hidden="true">
        <div className="absolute left-[-120px] top-20 h-[240px] w-[240px] rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute right-[-120px] top-56 h-[280px] w-[280px] rounded-full bg-green-200/20 blur-3xl" />
      </div>

      <div className="container-custom relative px-4 sm:px-6">
        {/* Header */}
        <div className="mb-6 rounded-2xl border border-white/75 bg-white/85 px-4 py-4 shadow-sm backdrop-blur-xl sm:mb-8 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                to="/shop"
                className="rounded-xl border border-slate-200/90 bg-white p-2 text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight text-slate-800 sm:text-2xl">
                  Checkout
                </h1>
                <p className="max-w-[19rem] text-xs font-medium leading-5 text-slate-500 sm:max-w-none sm:text-sm">
                  Secure and fast checkout in under 2 minutes
                </p>
              </div>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/80 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>
                {items.length} item{items.length === 1 ? "" : "s"}
              </span>
              <span className="text-emerald-300">•</span>
              <span>{formatPrice(finalTotal, settings.currency)}</span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-8 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl sm:mb-10 sm:p-5">
          <div className="sm:hidden">
            <div className="relative flex items-start justify-between px-1">
              <div className="absolute left-[56px] right-[56px] top-[18px] h-1 rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-500 ${step === "payment" ? "w-full" : "w-0"}`}
                />
              </div>

              <div className="relative z-10 flex w-[96px] flex-col items-center gap-2 text-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ring-4 transition-all duration-300 ${
                    step === "shipping"
                      ? "bg-emerald-600 text-white ring-emerald-100"
                      : "bg-emerald-100 text-emerald-700 ring-emerald-50"
                  }`}
                >
                  <Truck className="h-4 w-4" />
                </div>
                <span
                  className={`text-sm font-semibold leading-none ${
                    step === "shipping" ? "text-slate-800" : "text-slate-500"
                  }`}
                >
                  Shipping
                </span>
              </div>

              <div className="relative z-10 flex w-[96px] flex-col items-center gap-2 text-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ring-4 transition-all duration-300 ${
                    step === "payment"
                      ? "bg-emerald-600 text-white ring-emerald-100"
                      : "bg-slate-100 text-slate-400 ring-slate-50"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                </div>
                <span
                  className={`text-sm font-semibold leading-none ${
                    step === "payment" ? "text-slate-800" : "text-slate-500"
                  }`}
                >
                  Payment
                </span>
              </div>
            </div>
          </div>

          <div className="mx-auto hidden max-w-md items-center gap-3 sm:flex">
            <div className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full ring-4 transition-all duration-300 ${
                  step === "shipping"
                    ? "bg-emerald-600 text-white ring-emerald-100"
                    : "bg-emerald-100 text-emerald-700 ring-emerald-50"
                }`}
              >
                <Truck className="h-4 w-4" />
              </div>
              <span
                className={`text-xs font-semibold sm:text-sm ${step === "shipping" ? "text-slate-800" : "text-slate-500"}`}
              >
                Shipping
              </span>
            </div>

            <div className="h-1 flex-1 rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600 transition-all duration-500 ${step === "payment" ? "w-full" : "w-0"}`}
              />
            </div>

            <div className="flex flex-1 items-center justify-end gap-2">
              <span
                className={`text-xs font-semibold sm:text-sm ${step === "payment" ? "text-slate-800" : "text-slate-500"}`}
              >
                Payment
              </span>
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full ring-4 transition-all duration-300 ${
                  step === "payment"
                    ? "bg-emerald-600 text-white ring-emerald-100"
                    : "bg-slate-100 text-slate-400 ring-slate-50"
                }`}
              >
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-emerald-100/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Order Total
              </p>
              <p className="text-sm font-medium text-slate-600">
                {items.length} item{items.length === 1 ? "" : "s"} in cart
              </p>
            </div>
            <p className="font-display text-xl font-bold text-emerald-700">
              {formatPrice(finalTotal, settings.currency)}
            </p>
          </div>
          {isShippingStep && (
            <button
              type="button"
              onClick={() => setShowMobileSummary((prev) => !prev)}
              className="mt-3 w-full rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors duration-200 hover:bg-emerald-100"
            >
              {showMobileSummary ? "Hide order details" : "View order details"}
            </button>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-3 lg:items-start lg:gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            {step === "shipping" ? (
              <div className={checkoutPanelClass}>
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-100/50 blur-2xl" />
                <div className="mb-4 sm:mb-6">
                  <h2 className="font-display text-lg font-bold tracking-tight text-slate-800 sm:text-2xl">
                    Shipping Information
                  </h2>
                  <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
                    Where should we deliver your Naturanza order?
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 sm:gap-5">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={`${shippingData.firstName} ${shippingData.lastName}`.trim()}
                      onChange={handleFullNameChange}
                      autoComplete="name"
                      required
                      className={checkoutFieldClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={shippingData.email}
                      onChange={handleShippingChange}
                      inputMode="email"
                      autoComplete="email"
                      required
                      className={checkoutFieldClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={shippingData.phone}
                      onChange={handleShippingChange}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+92 300 1234567"
                      required
                      className={checkoutFieldClass}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Address *
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={shippingData.address}
                      onChange={handleShippingChange}
                      autoComplete="street-address"
                      placeholder="Street address, house number, etc."
                      required
                      className={checkoutFieldClass}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      City *
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={shippingData.city}
                      onChange={handleShippingChange}
                      autoComplete="address-level2"
                      required
                      className={checkoutFieldClass}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Postal Code *
                    </label>
                    <input
                      type="text"
                      name="postalCode"
                      value={shippingData.postalCode}
                      onChange={handleShippingChange}
                      autoComplete="postal-code"
                      required
                      className={checkoutFieldClass}
                    />
                  </div>
                </div>
                <button
                  onClick={() => setStep("payment")}
                  className={`mt-5 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold ${checkoutPrimaryButtonToneClass}`}
                >
                  Continue to Payment
                </button>
              </div>
            ) : (
              <div className={checkoutPanelClass}>
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-100/45 blur-2xl" />
                <div className="mb-4 sm:mb-6">
                  <h2 className="font-display text-lg font-bold tracking-tight text-slate-800 sm:text-2xl">
                    Payment Method
                  </h2>
                  <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
                    Choose your preferred payment option for this order.
                  </p>
                </div>

                {/* Payment Method Selection */}
                <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                  {/* Cash on Delivery */}
                  <label
                    className={getPaymentOptionClass(paymentMethod === "cod")}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={paymentMethod === "cod"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 focus:ring-green-500 flex-shrink-0"
                    />
                    <img
                      src="/images/payment%20logos/cash-on-delivery.png"
                      alt="Cash on Delivery"
                      className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 object-contain"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold leading-tight text-gray-900 sm:text-base">
                        Cash on Delivery
                      </span>
                      <p className="mt-0.5 text-xs leading-tight text-gray-500">
                        Pay when you receive your order
                      </p>
                    </div>
                    {paymentMethod === "cod" && (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                    )}
                  </label>

                  {/* EasyPaisa */}
                  <label
                    className={getPaymentOptionClass(
                      paymentMethod === "easypaisa",
                    )}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="easypaisa"
                      checked={paymentMethod === "easypaisa"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 focus:ring-green-500 flex-shrink-0"
                    />
                    <img
                      src="/images/payment%20logos/easypaisa.png"
                      alt="EasyPaisa"
                      className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 object-contain"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold leading-tight text-gray-900 sm:text-base">
                        EasyPaisa
                      </span>
                      <p className="mt-0.5 text-xs leading-tight text-gray-500">
                        Mobile wallet payment
                      </p>
                    </div>
                    {paymentMethod === "easypaisa" && (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                    )}
                  </label>

                  {/* JazzCash */}
                  <label
                    className={getPaymentOptionClass(paymentMethod === "jazzcash")}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="jazzcash"
                      checked={paymentMethod === "jazzcash"}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 focus:ring-green-500 flex-shrink-0"
                    />
                    <img
                      src="/images/payment%20logos/jazzcash.png"
                      alt="JazzCash"
                      className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 object-contain"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold leading-tight text-gray-900 sm:text-base">
                        JazzCash
                      </span>
                      <p className="mt-0.5 text-xs leading-tight text-gray-500">
                        Mobile wallet payment
                      </p>
                    </div>
                    {paymentMethod === "jazzcash" && (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                    )}
                  </label>

                  {/* Credit Card — Coming Soon */}
                  <div
                    className={`${getPaymentOptionClass(false)} opacity-60 cursor-not-allowed`}
                    title="Payment gateway integration coming soon"
                  >
                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold leading-tight text-gray-900 sm:text-base">
                        Credit / Debit Card
                      </span>
                      <p className="mt-0.5 text-xs leading-tight text-gray-500">
                        Payment gateway integration coming soon
                      </p>
                    </div>
                  </div>
                </div>

                {/* Conditional Payment Fields */}
                {paymentMethod === "easypaisa" && (
                  <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 sm:mb-6 sm:p-6">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 sm:mb-4 sm:text-base">
                      <img
                        src="/images/payment%20logos/easypaisa.png"
                        alt="EasyPaisa"
                        className="w-6 h-6 object-contain"
                      />
                      EasyPaisa Details
                    </h3>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-700 sm:text-sm">
                        EasyPaisa Mobile Number *
                      </label>
                      <input
                        type="tel"
                        name="easyPaisaNumber"
                        value={paymentData.easyPaisaNumber}
                        onChange={handlePaymentChange}
                        placeholder="03XX XXXXXXX"
                        required
                        className={checkoutFieldClass}
                      />
                      <p className="mt-2 text-xs text-slate-600">
                        You will receive a payment request on this number
                      </p>
                    </div>
                  </div>
                )}

                {paymentMethod === "jazzcash" && (
                  <div className="mb-4 rounded-2xl border border-rose-200/80 bg-rose-50/70 p-4 sm:mb-6 sm:p-6">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 sm:mb-4 sm:text-base">
                      <img
                        src="/images/payment%20logos/jazzcash.png"
                        alt="JazzCash"
                        className="w-6 h-6 object-contain"
                      />
                      JazzCash Details
                    </h3>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-700 sm:text-sm">
                        JazzCash Mobile Number *
                      </label>
                      <input
                        type="tel"
                        name="jazzCashNumber"
                        value={paymentData.jazzCashNumber}
                        onChange={handlePaymentChange}
                        placeholder="03XX XXXXXXX"
                        required
                        className={checkoutFieldClass}
                      />
                      <p className="mt-2 text-xs text-slate-600">
                        You will receive a payment request on this number
                      </p>
                    </div>
                  </div>
                )}

                {paymentMethod === "creditCard" && (
                  <div className="mb-4 rounded-2xl border border-sky-200/80 bg-sky-50/70 p-4 sm:mb-6 sm:p-6">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 sm:mb-4 sm:text-base">
                      <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      Card Details
                    </h3>
                    <div className="rounded-xl bg-sky-100/60 px-4 py-5 text-center">
                      <p className="text-sm font-medium text-sky-700">
                        Payment gateway integration coming soon
                      </p>
                      <p className="mt-1 text-xs text-sky-600">
                        Please use Cash on Delivery, EasyPaisa, or JazzCash
                      </p>
                    </div>
                  </div>
                )}

                {paymentMethod === "cod" && (
                  <div className="mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 sm:mb-6 sm:p-6">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 sm:text-base">
                      <img
                        src="/images/payment%20logos/cash-on-delivery.png"
                        alt="Cash on Delivery"
                        className="w-6 h-6 object-contain"
                      />
                      Cash on Delivery
                    </h3>
                    <p className="text-xs text-slate-700 sm:text-sm">
                      Please keep exact change ready. Our delivery partner will
                      collect{" "}
                      <span className="font-bold text-green-600">
                        {formatPrice(finalTotal, settings.currency)}
                      </span>{" "}
                      when your order arrives.
                    </p>
                  </div>
                )}

                {/* Error Message */}
                {error && (
                  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <div className="flex items-center gap-2 text-rose-700">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <button
                    onClick={() => setStep("shipping")}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 sm:h-12 sm:flex-1"
                  >
                    Back
                  </button>

                  <button
                    onClick={handlePlaceOrder}
                    disabled={isProcessing}
                    className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 sm:flex-1 ${checkoutPrimaryButtonToneClass}`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                        <span className="hidden xs:inline">Processing...</span>
                        <span className="xs:hidden">Wait...</span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Place Order
                      </>
                    )}
                  </button>
                </div>

                {/* Security Badge */}
                <div className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 sm:text-sm">
                  <Shield className="h-4 w-4" />
                  <span>Secure & encrypted payment</span>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div
            className={`mt-4 lg:col-span-1 lg:mt-0 lg:self-start ${
              isShippingStep && !showMobileSummary ? "hidden lg:block" : "block"
            }`}
          >
            <div className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-[0_16px_45px_rgba(15,23,42,0.09)] backdrop-blur lg:sticky lg:top-24 lg:max-h-none lg:overflow-visible sm:p-6">
              <h3 className="mb-1 font-display text-base font-bold tracking-tight text-slate-800 sm:text-xl">
                Order Summary
              </h3>
              <p className="mb-4 text-xs font-medium text-slate-500 sm:mb-6 sm:text-sm">
                {items.length} item{items.length === 1 ? "" : "s"} in your order
              </p>
              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                {items.map((item) => (
                  <div
                    key={getCheckoutItemKey(item)}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 sm:gap-4"
                  >
                    <img
                      src={getCheckoutItemImage(item)}
                      alt={item.name}
                      className="h-14 w-14 flex-shrink-0 rounded-lg bg-white object-contain p-1.5 ring-1 ring-slate-100 sm:h-16 sm:w-16"
                      onError={(event) => {
                        event.currentTarget.src =
                          "/images/products/powder.webp";
                      }}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                      <h4 className="break-words text-sm font-semibold leading-5 text-slate-800">
                        {item.name}
                      </h4>
                      <p className="text-xs leading-4 text-slate-500 sm:text-sm">
                        Qty: {item.quantity}
                      </p>
                      <p className="text-[1.05rem] font-semibold leading-5 text-emerald-700 sm:text-base">
                        {formatPrice(
                          getCheckoutUnitPrice(item) * item.quantity,
                          settings.currency,
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-3 border-t border-slate-200 pt-4 sm:space-y-4">
                {/* Coupon Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-medium text-slate-700 sm:text-sm">
                      Have a coupon code?
                    </label>
                    {availableCoupons.length > 0 && !appliedCoupon && (
                      <button
                        onClick={() =>
                          setShowAvailableCoupons(!showAvailableCoupons)
                        }
                        className="text-xs font-medium text-emerald-600 transition-colors duration-200 hover:text-emerald-700"
                      >
                        {showAvailableCoupons
                          ? "Hide"
                          : "View available coupons"}
                      </button>
                    )}
                  </div>

                  {/* Available Coupons List */}
                  {showAvailableCoupons &&
                    availableCoupons.length > 0 &&
                    !appliedCoupon && (
                      <div className="mb-3 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                        {availableCoupons.map((coupon) => (
                          <div
                            key={coupon.code}
                            className="cursor-pointer rounded-lg border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-2.5 transition-all duration-200 hover:shadow-md"
                            onClick={() => handleApplyCoupon(coupon.code)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Tag className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                <p className="font-mono font-bold text-green-700 text-xs">
                                  {coupon.code}
                                </p>
                              </div>
                              {coupon.description && (
                                <p className="mt-0.5 truncate text-xs text-slate-600">
                                  {coupon.description}
                                </p>
                              )}
                              <p className="mt-0.5 text-xs text-slate-500">
                                {coupon.discount_type === "percentage"
                                  ? `${coupon.discount_value}% off`
                                  : `${formatPrice(coupon.discount_value, settings.currency)} off`}
                                {coupon.min_order_amount > 0 &&
                                  ` on orders above ${formatPrice(coupon.min_order_amount, settings.currency)}`}
                              </p>
                              </div>
                              <button
                                className={`flex-shrink-0 rounded px-3 py-1 text-xs font-semibold ${checkoutPrimaryButtonToneClass}`}
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  {appliedCoupon ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-2.5 sm:p-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Tag className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono font-bold text-green-700 text-xs sm:text-sm truncate">
                            {appliedCoupon.code}
                          </p>
                          {appliedCoupon.description && (
                            <p className="text-xs text-green-600 truncate">
                              {appliedCoupon.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveCoupon}
                        className="flex-shrink-0 p-1.5 text-rose-600 transition-colors duration-200 hover:text-rose-800"
                        aria-label="Remove coupon"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col xs:flex-row gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) =>
                            setCouponCode(e.target.value.toUpperCase())
                          }
                          placeholder="Enter code"
                          className={`${checkoutFieldClass} flex-1 w-full xs:w-auto`}
                          onKeyPress={(e) =>
                            e.key === "Enter" && handleApplyCoupon()
                          }
                        />
                        <button
                          onClick={() => handleApplyCoupon()}
                          disabled={isValidatingCoupon}
                          className={`h-11 w-full whitespace-nowrap rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 xs:w-auto xs:min-w-[90px] sm:px-6 ${checkoutPrimaryButtonToneClass}`}
                        >
                          {isValidatingCoupon ? (
                            <span className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                              <span className="hidden xs:inline">
                                Checking...
                              </span>
                            </span>
                          ) : (
                            "Apply"
                          )}
                        </button>
                      </div>
                      {couponError && (
                        <p className="mt-2 px-1 text-xs text-rose-600">
                          {couponError}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Price Breakdown */}
                <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:space-y-3 sm:p-4">
                  <div className="flex items-center justify-between text-sm text-slate-600 sm:text-base">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-700">
                      {formatPrice(subtotal, settings.currency)}
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex items-start justify-between text-sm font-semibold text-emerald-600 sm:text-base">
                      <span className="flex items-center gap-1 flex-1 min-w-0">
                        <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate">
                          Discount ({appliedCoupon?.code})
                        </span>
                      </span>
                      <span className="ml-2 flex-shrink-0">
                        -{formatPrice(discount, settings.currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm text-slate-600 sm:text-base">
                    <span>Shipping</span>
                    <span className="font-semibold text-emerald-700">Free</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600 sm:text-base">
                    <span>Tax ({settings.taxRate}%)</span>
                    <span className="font-semibold text-slate-700">
                      {formatPrice(tax, settings.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 font-display text-base font-bold sm:pt-3 sm:text-xl">
                    <span>Total</span>
                    <span className="text-emerald-700">
                      {formatPrice(finalTotal, settings.currency)}
                    </span>
                  </div>
                  {discount > 0 && (
                    <p className="text-right text-xs font-medium text-emerald-600 sm:text-sm">
                      You saved {formatPrice(discount, settings.currency)}! 🎉
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-2 shadow-sm backdrop-blur-xl sm:mt-4 sm:px-5 sm:py-2.5">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-slate-500 sm:text-sm">
            <Link
              to="/terms"
              className="transition-colors duration-200 hover:text-emerald-700"
            >
              Terms
            </Link>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <Link
              to="/privacy"
              className="transition-colors duration-200 hover:text-emerald-700"
            >
              Privacy
            </Link>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <Link
              to="/contact"
              className="transition-colors duration-200 hover:text-emerald-700"
            >
              Need Help?
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
