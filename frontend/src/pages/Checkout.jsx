import { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Trash2,
  Truck,
  Shield,
  CheckCircle2,
  Check,
  X,
  AlertCircle,
  ShoppingBag,
  Receipt,
  Lock,
  Tag,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useOrders } from "@/context/OrderContext";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice, computeStoreSaleDiscount } from "@/lib/utils";
import api, { paymentAPI, cartAPI } from "@/services/api";
import { NoIndexSEO } from "@/components/SEO";
import { getAbsoluteImageUrl } from "@/lib/imageUtils";
import { safeLocalStorage } from "@/lib/storage";

const http = api.axiosInstance;

const STORAGE_KEY = "naturanza_checkout_shipping";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_SHIPPING_DATA = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  postalCode: "",
};

const getShippingStorageKey = (userId) =>
  userId ? `${STORAGE_KEY}:${userId}` : null;

const readStoredShippingData = (userId) => {
  const storageKey = getShippingStorageKey(userId);
  if (typeof window === "undefined" || !storageKey) {
    return null;
  }

  try {
    const saved = safeLocalStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export function Checkout() {
  const { items, totalPrice, clearCart, updateQuantity, removeFromCart, loading: cartLoading, error: cartError, fetchCart } = useCart();
  const { addOrder } = useOrders();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const supportEmail = settings.storeEmail || "support@naturanzafood.com";
  const [step, setStep] = useState("shipping");
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [confirmedDiscount, setConfirmedDiscount] = useState(0);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [error, setError] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [showAvailableCoupons, setShowAvailableCoupons] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [showCartLoading, setShowCartLoading] = useState(false);
  const couponValidationRequestRef = useRef(0);

  useEffect(() => {
    let loadingTimer;

    if (authLoading) {
      return () => {};
    }

    if (!isAuthenticated) {
      setCartHydrated(true);
      setShowCartLoading(false);
      return () => {};
    }

    if (cartLoading) {
      loadingTimer = setTimeout(() => {
        setShowCartLoading(true);
      }, 300);
    } else {
      setShowCartLoading(false);
      setCartHydrated(true);
    }

    return () => {
      if (loadingTimer) {
        clearTimeout(loadingTimer);
      }
    };
  }, [authLoading, isAuthenticated, cartLoading]);

  // Fetch available coupons
  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setAvailableCoupons([]);
      return undefined;
    }

    const fetchAvailableCoupons = async () => {
      try {
        const response = await http.get("/coupons/active");
        setAvailableCoupons(response.data);
      } catch (error) {
        // Non-fatal: the page still works without the promo list — just log.
        console.warn("[checkout] failed to load active coupons:", error?.message);
      }
    };
    fetchAvailableCoupons();
    return undefined;
  }, [authLoading, isAuthenticated]);

  // Recalculate coupon discount when cart total changes
  useEffect(() => {
    if (appliedCoupon && appliedCoupon.code) {
      const revalidateCoupon = async () => {
        const requestId = ++couponValidationRequestRef.current;
        try {
          const response = await http.post("/coupons/validate", {
            code: appliedCoupon.code,
            orderAmount: totalPrice,
          });

          if (requestId !== couponValidationRequestRef.current) return;
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
          if (requestId !== couponValidationRequestRef.current) return;
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
  const [shippingData, setShippingData] = useState(() => {
    return readStoredShippingData(user?.id) || EMPTY_SHIPPING_DATA;
  });

  // Field validation state (touched = user left field)
  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldValid, setFieldValid] = useState({});

  // Save shipping data to localStorage
  useEffect(() => {
    const storageKey = getShippingStorageKey(user?.id);
    if (typeof window !== "undefined" && storageKey && step === "shipping") {
      try {
        safeLocalStorage.removeItem(STORAGE_KEY);
        safeLocalStorage.setItem(storageKey, JSON.stringify(shippingData));
      } catch { /* ignored: not fatal to this flow */ }
    }
  }, [shippingData, step, user?.id]);

  // Validation helpers
  const validatePhone = (val) => {
    const cleaned = String(val || "").replace(/\D/g, "");
    if (!cleaned) return "Phone number is required";
    if (cleaned.length !== 11) return "Must be exactly 11 digits";
    if (!cleaned.startsWith("03")) return "Must start with 03";
    return null;
  };

  const validateEmail = (val) => {
    if (!val) return "Email is required";
    if (!emailRegex.test(val)) return "Invalid email format";
    return null;
  };

  const validateFullName = (val) => {
    if (!val || !val.trim()) return "Full name is required";
    if (val.trim().length < 3) return "Minimum 3 characters required";
    return null;
  };

  const validatePostalCode = (val) => {
    const cleaned = String(val || "").replace(/\D/g, "");
    if (!cleaned) return null; // optional field
    if (cleaned.length !== 5) return "Must be exactly 5 digits";
    return null;
  };

  const handleFieldBlur = (name, value) => {
    let error = null;
    if (name === "phone") error = validatePhone(value);
    else if (name === "email") error = validateEmail(value);
    else if (name === "fullName") error = validateFullName(value);
    else if (name === "postalCode") error = validatePostalCode(value);

    setFieldErrors((prev) => ({ ...prev, [name]: error }));
    setFieldValid((prev) => ({ ...prev, [name]: !error && value }));
  };

  // Validate all required shipping fields before allowing "Continue to Payment".
  // Returns true only if every required (*) field is valid.
  const validateShippingForm = () => {
    const fullName = `${shippingData.firstName} ${shippingData.lastName}`.trim();
    const errors = {};
    const fullNameError = validateFullName(fullName);
    if (fullNameError) errors.fullName = fullNameError;
    const emailError = validateEmail(shippingData.email);
    if (emailError) errors.email = emailError;
    const phoneError = validatePhone(shippingData.phone);
    if (phoneError) errors.phone = phoneError;
    if (!String(shippingData.address || "").trim()) errors.address = "Address is required";
    if (!String(shippingData.city || "").trim()) errors.city = "Please select a city";
    const postalError = validatePostalCode(shippingData.postalCode);
    if (postalError) errors.postalCode = postalError;

    setFieldErrors((prev) => ({ ...prev, ...errors }));
    setFieldValid((prev) => {
      const next = { ...prev };
      ["fullName", "email", "phone", "address", "city"].forEach((f) => {
        if (errors[f]) delete next[f];
      });
      return next;
    });
    return Object.keys(errors).length === 0;
  };

  const getFieldState = (name) => {
    const touched = fieldErrors[name] !== undefined || fieldValid[name] !== undefined;
    if (!touched) return "default";
    return fieldErrors[name] ? "invalid" : "valid";
  };

  const [, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  useEffect(() => {
    setShippingData(readStoredShippingData(user?.id) || EMPTY_SHIPPING_DATA);
  }, [user?.id]);

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
    if (authLoading || !isAuthenticated || !user?.id) {
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
        }));
      } catch {
        setSavedAddresses([]);
        setSelectedAddressId(null);
      }
    };

    loadSavedAddresses();
  }, [authLoading, isAuthenticated, user?.id]);

  // Payment state (SafePay + COD only — manual wallet/bank flows removed)
  const [paymentMethod, setPaymentMethod] = useState("safepay");
  const [activePaymentMethods, setActivePaymentMethods] = useState([]);
  const [paymentMethodsLoaded, setPaymentMethodsLoaded] = useState(false);
  const [paymentMethodsError, setPaymentMethodsError] = useState("");
  const [shippingCities, setShippingCities] = useState([]);
  const [shippingCitiesLoading, setShippingCitiesLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadPaymentMethods = async () => {
      if (authLoading) {
        return;
      }

      if (!isAuthenticated || !user?.id) {
        if (isMounted) {
          setActivePaymentMethods([]);
          setPaymentMethodsError("");
          setPaymentMethodsLoaded(true);
        }
        return;
      }

      setPaymentMethodsLoaded(false);
      setPaymentMethodsError("");

      try {
        const response = await paymentAPI.getActiveMethods();
        if (isMounted) {
          setActivePaymentMethods(Array.isArray(response) ? response : []);
        }
      } catch (error) {
        if (isMounted) {
          setActivePaymentMethods([]);
          setPaymentMethodsError(
            error?.response?.data?.error ||
              "Unable to load payment methods. Please refresh and try again.",
          );
        }
      } finally {
        if (isMounted) {
          setPaymentMethodsLoaded(true);
        }
      }
    };

    loadPaymentMethods();

    return () => {
      isMounted = false;
    };
  }, [authLoading, isAuthenticated, user?.id]);

  // Fetch active shipping cities
  useEffect(() => {
    let isMounted = true;
    const loadShippingCities = async () => {
      try {
        const response = await http.get("/shipping/city-fees/active");
        if (isMounted) {
          setShippingCities(Array.isArray(response.data) ? response.data : []);
        }
      } catch {
        if (isMounted) {
          setShippingCities([]);
        }
      } finally {
        if (isMounted) {
          setShippingCitiesLoading(false);
        }
      }
    };
    loadShippingCities();
    return () => {
      isMounted = false;
    };
  }, []);

  const activePaymentMethodCodes = useMemo(
    () =>
      new Set(
        activePaymentMethods
          .map((method) => String(method.code || "").trim().toLowerCase())
          .filter(Boolean),
      ),
    [activePaymentMethods],
  );

  const safepayMethod = useMemo(
    () =>
      activePaymentMethods.find(
        (method) => String(method.code || "").trim().toLowerCase() === "safepay",
      ) || null,
    [activePaymentMethods],
  );

  const codMethod = useMemo(
    () =>
      activePaymentMethods.find(
        (method) => String(method.code || "").trim().toLowerCase() === "cod",
      ) || null,
    [activePaymentMethods],
  );

  const safepayGatewayConfigured = Boolean(safepayMethod?.gateway_configured);

  const isCheckoutPaymentMethodAvailable = (method) =>
    !paymentMethodsLoaded || activePaymentMethodCodes.has(method);

  useEffect(() => {
    if (!paymentMethodsLoaded) {
      return;
    }

    setPaymentMethod((currentMethod) => {
      if (activePaymentMethodCodes.has(currentMethod)) {
        return currentMethod;
      }

      if (activePaymentMethodCodes.has("safepay")) {
        return "safepay";
      }

      return String(activePaymentMethods[0]?.code || "").trim().toLowerCase();
    });
  }, [activePaymentMethodCodes, activePaymentMethods, paymentMethodsLoaded]);

  const handleShippingChange = (e) => {
    const { name, value } = e.target;
    setFieldErrors((prev) => { const n = {...prev}; delete n[name]; return n; });
    setFieldValid((prev) => { const n = {...prev}; delete n[name]; return n; });
    setShippingData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFullNameChange = (e) => {
    const fullNameValue = e.target.value;
    setFieldErrors((prev) => { const n = {...prev}; delete n.fullName; return n; });
    setFieldValid((prev) => { const n = {...prev}; delete n.fullName; return n; });
    setShippingData((prev) => ({
      ...prev,
      firstName: fullNameValue,
      lastName: "",
    }));
  };

  const handlePaymentMethodSelect = (method) => {
    if (paymentMethodsLoaded && !activePaymentMethodCodes.has(method)) {
      return;
    }
    setError("");
    setPaymentMethod(method);
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

  // Calculate totals. A store-wide sale (admin setting) takes priority over
  // coupons: when active, coupons are disabled and the discount is the store
  // sale reduction. When inactive, the coupon discount applies as before.
  const subtotal = totalPrice;
  const storeSaleActive =
    Boolean(settings.storeDiscountActive) && (Number(settings.storeDiscountPercentage) || 0) > 0;
  const storeSaleDiscount = storeSaleActive ? computeStoreSaleDiscount(items, settings) : 0;
  const couponDiscount = parseFloat(appliedCoupon?.discount_amount) || 0;
  const discount = storeSaleActive ? storeSaleDiscount : couponDiscount;
  const selectedCityData = shippingCities.find(c => c.city_name === shippingData.city);
  const freeShippingThreshold = Number(settings.shippingFree) || 5000;
  const isShippingFree = paymentMethod !== 'cod' && (subtotal - discount) >= freeShippingThreshold;
  const deliveryFee = (selectedCityData && !isShippingFree) ? parseInt(selectedCityData.fee, 10) || 0 : 0;
  const hasDeliveryFee = selectedCityData !== undefined;
  const finalTotal = subtotal - discount + deliveryFee;
  const payOnDeliveryAmount = Math.max(0, subtotal - discount);

  const codUsesSafepayAdvance =
    paymentMethod === "cod" &&
    deliveryFee > 0 &&
    Boolean(codMethod?.safepay_advance_enabled);

  const buildOrderPayload = () => ({
    customer_name: customerFullName,
    customer_email: shippingData.email,
    shipping_address: [shippingData.address, shippingData.city, shippingData.postalCode]
      .filter(Boolean)
      .join(", "),
    phone: shippingData.phone,
    city: shippingData.city,
    address_id: selectedAddressId || null,
    payment_method: paymentMethod,
    coupon_code: appliedCoupon?.code || null,
  });
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
  const isCartReady = cartHydrated && !cartLoading;
  const canContinueToPayment = isCartReady && items.length > 0;
  const canPlaceOrder =
    isCartReady &&
    items.length > 0 &&
    !isProcessing &&
    paymentMethodsLoaded &&
    Boolean(paymentMethod) &&
    activePaymentMethodCodes.has(paymentMethod);
  const getCheckoutItemKey = (item) => item.product_id ?? item.id ?? item.name;
  const getCheckoutItemImage = (item) =>
    getAbsoluteImageUrl(
      item.image_url || item.image || "/images/products/honey.webp",
      { defaultFolder: "products" },
    );
  const getCheckoutUnitPrice = (item) => item.final_price ?? item.price;
  const customerFullName =
    `${shippingData.firstName} ${shippingData.lastName}`.trim() ||
    user?.name ||
    "Customer";

  const handlePlaceOrder = async () => {
    if (!paymentMethodsLoaded || !activePaymentMethodCodes.has(paymentMethod)) {
      setError(
        paymentMethodsError ||
          "Selected payment method is currently unavailable. Please choose another method.",
      );
      return;
    }

    if (paymentMethod === "safepay" && !safepayGatewayConfigured) {
      setError(
        "SafePay gateway keys are not configured yet on this server. Add SAFEPAY_API_KEY and SAFEPAY_SECRET_KEY in backend/.env or choose Cash on Delivery.",
      );
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      let activeOrderId = orderId;
      let createdOrder = null;

      if (!activeOrderId) {
        try {
          const cartResponse = await cartAPI.get();
          const fetchedItems = Array.isArray(cartResponse.items) ? cartResponse.items : [];
          if (fetchedItems.length === 0) {
            setError("Your cart is empty. Please add items before placing an order.");
            return;
          }
        } catch {
          setError("Unable to verify cart. Please refresh the page and try again.");
          return;
        }

        if (subtotal < 1) {
          setError(`Order subtotal must be at least ${formatPrice(1, settings.currency)} to place an order.`);
          return;
        }

        const orderData = buildOrderPayload();
        createdOrder = await addOrder(orderData);

        if (!createdOrder || !createdOrder.id) {
          throw new Error("Order creation failed - no order ID returned");
        }

        activeOrderId = createdOrder.id;
        setOrderId(createdOrder.id);
      }

      const needsSafepayRedirect =
        createdOrder?.requires_safepay ??
        (paymentMethod === "safepay" || codUsesSafepayAdvance);

      if (needsSafepayRedirect) {
        const session = await paymentAPI.createSafepaySession(activeOrderId);
        if (!session?.checkout_url) {
          throw new Error("SafePay did not return a valid checkout URL.");
        }
        try {
          const storageKey = getShippingStorageKey(user?.id);
          if (storageKey) safeLocalStorage.removeItem(storageKey);
          safeLocalStorage.removeItem(STORAGE_KEY);
        } catch { /* ignored: not fatal to this flow */ }
        window.location.assign(session.checkout_url);
        return;
      }

      const orderNum = `ORD-${activeOrderId.toString().padStart(6, "0")}`;
      const authoritativeTotal = Number(createdOrder?.total_amount ?? finalTotal) || 0;
      const authoritativeDiscount = Number(createdOrder?.discount_amount ?? discount) || 0;
      setOrderNumber(orderNum);
      setConfirmedTotal(authoritativeTotal);
      setConfirmedDiscount(authoritativeDiscount);

      setStep("confirmation");
      clearCart();
      try {
        const storageKey = getShippingStorageKey(user?.id);
        if (storageKey) safeLocalStorage.removeItem(storageKey);
        safeLocalStorage.removeItem(STORAGE_KEY);
      } catch { /* ignored: not fatal to this flow */ }
    } catch (error) {
      const statusCode = Number(error?.response?.status || 0);
      const errorMessage = String(error?.response?.data?.error || error?.message || "").toLowerCase();

      if (statusCode === 401 || statusCode === 403 || errorMessage.includes("token") || errorMessage.includes("unauthorized") || errorMessage.includes("access token")) {
        setError("Your session has expired. Please login again to continue.");
      } else if (statusCode === 400 && errorMessage.includes("cart is empty")) {
        setError("Your cart appears to be empty. Please add items before placing an order.");
      } else if (!error?.response) {
        setError("Unable to connect to server. Please check your internet connection and try again.");
      } else {
        const backendError = error.response?.data?.error || "Failed to place order. Please try again.";
        setError(backendError);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Don't show empty cart until cart has finished loading
  if (showCartLoading && items.length === 0 && step !== "confirmation") {
    return (
      <>
        <NoIndexSEO title="Checkout - Loading" />
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf5_0%,_#f8fafc_38%,_#faf8f3_100%)] pt-24 pb-16">
          <div className="container-custom max-w-xl px-4">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-8 text-center shadow-[0_20px_55px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10">
            <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-800">
              Loading your cart...
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-slate-500">
              Please wait while we load your cart items.
            </p>
          </div>
        </div>
      </main>
      </>
    );
  }

  // If cart error exists, show error with retry option
  if (cartHydrated && cartError && items.length === 0 && step !== "confirmation") {
    return (
      <>
        <NoIndexSEO title="Checkout - Cart Error" />
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf5_0%,_#f8fafc_38%,_#faf8f3_100%)] pt-24 pb-16">
          <div className="container-custom max-w-xl px-4">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-8 text-center shadow-[0_20px_55px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10">
            <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/30">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-800">
              Unable to load cart
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-slate-500">
              {cartError}
            </p>
            <button
              onClick={() => fetchCart()}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:from-emerald-600 hover:to-green-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
      </>
    );
  }

  if (cartHydrated && items.length === 0 && step !== "confirmation") {
    return (
      <>
        <NoIndexSEO title="Checkout - Empty Cart" />
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
      </>
    );
  }

  if (step === "confirmation") {
    return (
      <>
        <NoIndexSEO title="Order Confirmed - Naturanza Food" />
        <div className="container-custom max-w-2xl pt-24 sm:pt-28 pb-16">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.1)] backdrop-blur sm:p-8 md:p-12">
            {/* Success Icon */}
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30 sm:mb-6 sm:h-24 sm:w-24">
              <CheckCircle2 className="h-11 w-11 sm:h-14 sm:w-14" />
            </div>

            {/* Success Message */}
            <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              Order Confirmed!
            </h1>
            <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8">
              Thank you for your purchase. Your order has been successfully placed.
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
                  <p className="font-semibold text-sm sm:text-base text-gray-900">
                    {paymentMethod === "safepay" ? "💳 SafePay" : "💵 Cash on Delivery"}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Amount</p>
                  <p className="font-bold text-lg sm:text-xl text-green-600">
                    {formatPrice(confirmedTotal, settings.currency)}
                  </p>
                  {confirmedDiscount > 0 && (
                    <p className="text-xs text-gray-500">
                      <span className="line-through">
                        {formatPrice(confirmedTotal + confirmedDiscount, settings.currency)}
                      </span>
                      <span className="text-green-600 ml-1">
                        -{formatPrice(confirmedDiscount, settings.currency)}
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
                {paymentMethod === "cod" && (
                  <div className="col-span-2">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Payment Status</p>
                    <p className="font-semibold text-sm sm:text-base text-gray-900">
                      Cash on Delivery ({formatPrice(confirmedTotal || payOnDeliveryAmount, settings.currency)} due at delivery)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Status */}
            <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:mb-8 sm:p-4">
              <p className="text-xs sm:text-sm text-blue-900">
                A confirmation email has been sent to{" "}
                <span className="font-semibold">{shippingData.email}</span>
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-4">
              <Link
                to="/orders"
                className="flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 text-sm sm:text-base font-semibold text-white shadow-lg transition-all hover:from-green-700 hover:to-emerald-700 hover:shadow-xl sm:flex-1"
              >
                View My Orders
              </Link>
              <button
                onClick={() => window.print()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-300 px-5 text-sm sm:text-base font-semibold text-gray-700 hover:bg-gray-50 sm:flex-1"
              >
                <Receipt className="h-4 w-4 shrink-0" />
                Print Receipt
              </button>
            </div>

            {/* Help Text */}
            <p className="text-[11px] sm:text-xs text-gray-500 mt-5 sm:mt-6">
              Need help? Contact our support team at {supportEmail}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <NoIndexSEO title="Checkout" />
      <div className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block" aria-hidden="true">
        <div className="absolute left-[-120px] top-20 h-[240px] w-[240px] rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute right-[-120px] top-56 h-[280px] w-[280px] rounded-full bg-green-200/20 blur-3xl" />
      </div>

      <div className="container-custom relative px-4 sm:px-6 pt-24 sm:pt-28 pb-16">
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
                    <div className="relative">
                      <input
                        type="text"
                        name="fullName"
                        value={
                          shippingData.lastName
                            ? `${shippingData.firstName} ${shippingData.lastName}`
                            : shippingData.firstName
                        }
                        onChange={handleFullNameChange}
                        onBlur={(e) => handleFieldBlur("fullName", e.target.value)}
                        autoComplete="name"
                        required
                        className={`${checkoutFieldClass} pr-10 ${getFieldState("fullName") === "valid" ? "border-emerald-400 bg-emerald-50/50" : getFieldState("fullName") === "invalid" ? "border-red-400 bg-red-50/50" : ""}`}
                      />
                      {getFieldState("fullName") === "valid" && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 pointer-events-none" />
                      )}
                      {getFieldState("fullName") === "invalid" && (
                        <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500 pointer-events-none" />
                      )}
                    </div>
                    {fieldErrors.fullName && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {fieldErrors.fullName}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Email *
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        name="email"
                        value={shippingData.email}
                        onChange={handleShippingChange}
                        onBlur={(e) => handleFieldBlur("email", e.target.value)}
                        inputMode="email"
                        autoComplete="email"
                        required
                        className={`${checkoutFieldClass} pr-10 ${getFieldState("email") === "valid" ? "border-emerald-400 bg-emerald-50/50" : getFieldState("email") === "invalid" ? "border-red-400 bg-red-50/50" : ""}`}
                      />
                      {getFieldState("email") === "valid" && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 pointer-events-none" />
                      )}
                      {getFieldState("email") === "invalid" && (
                        <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500 pointer-events-none" />
                      )}
                    </div>
                    {fieldErrors.email && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        name="phone"
                        value={shippingData.phone}
                        onChange={handleShippingChange}
                        onBlur={(e) => handleFieldBlur("phone", e.target.value)}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="tel"
                        placeholder="0300 1234567"
                        required
                        className={`${checkoutFieldClass} pr-10 ${getFieldState("phone") === "valid" ? "border-emerald-400 bg-emerald-50/50" : getFieldState("phone") === "invalid" ? "border-red-400 bg-red-50/50" : ""}`}
                      />
                      {getFieldState("phone") === "valid" && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 pointer-events-none" />
                      )}
                      {getFieldState("phone") === "invalid" && (
                        <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500 pointer-events-none" />
                      )}
                    </div>
                    {fieldErrors.phone && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {fieldErrors.phone}
                      </p>
                    )}
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
                      className={`${checkoutFieldClass} ${getFieldState("address") === "invalid" ? "border-red-400 bg-red-50/50" : ""}`}
                    />
                    {fieldErrors.address && (
                      <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.address}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      City *
                    </label>
                    <div className="relative">
                      <select
                        name="city"
                        value={shippingData.city}
                        onChange={handleShippingChange}
                        autoComplete="address-level2"
                        required
                        disabled={shippingCitiesLoading}
                        className={`${checkoutFieldClass} appearance-none pr-10 cursor-pointer ${getFieldState("city") === "invalid" ? "border-red-400 bg-red-50/50" : ""}`}
                      >
                        <option value="" disabled>
                          {shippingCitiesLoading ? "Loading cities..." : "Select city"}
                        </option>
                        {!shippingCitiesLoading && shippingCities.map((city) => (
                          <option key={city.id} value={city.city_name}>
                            {city.city_name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 pointer-events-none" />
                    </div>
                    {fieldErrors.city && (
                      <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.city}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Postal Code
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="postalCode"
                        value={shippingData.postalCode || ""}
                        onChange={handleShippingChange}
                        onBlur={(e) => handleFieldBlur("postalCode", e.target.value)}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={5}
                        autoComplete="postal-code"
                        placeholder="12345"
                        className={`${checkoutFieldClass} pr-10 ${getFieldState("postalCode") === "valid" ? "border-emerald-400 bg-emerald-50/50" : getFieldState("postalCode") === "invalid" ? "border-red-400 bg-red-50/50" : ""}`}
                      />
                      {getFieldState("postalCode") === "valid" && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 pointer-events-none" />
                      )}
                      {getFieldState("postalCode") === "invalid" && (
                        <X className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500 pointer-events-none" />
                      )}
                    </div>
                    {fieldErrors.postalCode && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {fieldErrors.postalCode}
                      </p>
                    )}
                  </div>
                </div>

                {/* Trust Signals */}
                <div className="mt-6 mb-4 flex flex-wrap items-center justify-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                    <Shield className="h-3.5 w-3.5" />
                    SafePay Gateway
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    <Truck className="h-3.5 w-3.5" />
                    Cash on Delivery
                  </span>
                </div>
                <div className="flex items-center gap-2 justify-center mb-3">
                  <Lock className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-700">100% Secure Encrypted Checkout</span>
                </div>

                {error && (
                  <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!canContinueToPayment) return;
                    if (!validateShippingForm()) {
                      setError("Please fill in all required (*) fields correctly before continuing.");
                      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                      return;
                    }
                    setError("");
                    setStep("payment");
                  }}
                  disabled={!canContinueToPayment}
                  className={`mt-1 inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${checkoutPrimaryButtonToneClass}`}
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

                {paymentMethodsError && (
                  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <div className="flex items-center gap-2 text-rose-700">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <p className="text-sm font-medium">{paymentMethodsError}</p>
                    </div>
                  </div>
                )}

                {paymentMethodsLoaded &&
                  !paymentMethodsError &&
                  activePaymentMethods.length === 0 && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-medium text-amber-800">
                        No payment methods are currently available. Please contact support.
                      </p>
                    </div>
                  )}

                {/* Payment Method Selection (SafePay + COD only) */}
                <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                  {/* SafePay Online Payment */}
                  <label
                    className={`${getPaymentOptionClass(paymentMethod === "safepay")} ${
                      isCheckoutPaymentMethodAvailable("safepay") ? "" : "hidden"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="safepay"
                      checked={paymentMethod === "safepay"}
                      onChange={(e) => handlePaymentMethodSelect(e.target.value)}
                      className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 focus:ring-green-500 flex-shrink-0"
                    />
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-green-700 text-white shadow-sm">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="block text-sm font-semibold leading-tight text-gray-900 sm:text-base">
                          SafePay Online Payment
                        </span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                          Instant
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-tight text-gray-500">
                        Pay securely via Visa, Mastercard, Raast, or mobile wallets on SafePay
                      </p>
                    </div>
                    {paymentMethod === "safepay" && (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                    )}
                  </label>

                  {/* Cash on Delivery */}
                  <label
                    className={`${getPaymentOptionClass(paymentMethod === "cod")} ${
                      isCheckoutPaymentMethodAvailable("cod") ? "" : "hidden"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={paymentMethod === "cod"}
                      onChange={(e) => handlePaymentMethodSelect(e.target.value)}
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
                        {deliveryFee > 0 && codMethod?.safepay_advance_enabled
                          ? `Pay ${formatPrice(deliveryFee, settings.currency)} delivery fee via SafePay & ${formatPrice(payOnDeliveryAmount, settings.currency)} cash on delivery`
                          : "Pay in cash when you receive your order"}
                      </p>
                    </div>
                    {paymentMethod === "cod" && (
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                    )}
                  </label>
                </div>

                {/* SafePay Details Box */}
                {paymentMethod === "safepay" && (
                  <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 sm:mb-6 sm:p-5">
                    <div className="flex items-start gap-3">
                      <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700" />
                      <div className="space-y-1.5 text-xs sm:text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">
                          Total payable via SafePay: {formatPrice(finalTotal, settings.currency)}
                        </p>
                        <p className="text-slate-600">
                          You will be redirected to SafePay&apos;s encrypted checkout to complete payment instantly. No manual screenshot or verification needed.
                        </p>
                        {paymentMethodsLoaded && !safepayGatewayConfigured && (
                          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                            SafePay API keys are not set in this local environment yet (`SAFEPAY_API_KEY` / `SAFEPAY_SECRET_KEY` in `backend/.env`).
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* COD Details Box */}
                {paymentMethod === "cod" && (
                  <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:mb-6 sm:p-5">
                    <div className="space-y-2 text-xs sm:text-sm">
                      {codUsesSafepayAdvance ? (
                        <>
                          <div className="flex items-center justify-between text-emerald-800">
                            <span className="font-medium">Delivery fee via SafePay (now):</span>
                            <span className="font-bold">{formatPrice(deliveryFee, settings.currency)}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-700">
                            <span className="font-medium">Remaining cash on delivery:</span>
                            <span className="font-bold">{formatPrice(payOnDeliveryAmount, settings.currency)}</span>
                          </div>
                          <p className="pt-1 text-xs text-slate-500">
                            Your order is confirmed automatically once SafePay verifies the delivery fee.
                          </p>
                        </>
                      ) : (
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="font-medium">Cash payable on delivery:</span>
                          <span className="font-bold text-slate-900">{formatPrice(finalTotal, settings.currency)}</span>
                        </div>
                      )}
                    </div>
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
                    disabled={isProcessing}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-60 sm:h-12 sm:flex-1"
                  >
                    Back
                  </button>

                  <button
                    onClick={handlePlaceOrder}
                    disabled={!canPlaceOrder}
                    className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 sm:flex-1 ${checkoutPrimaryButtonToneClass}`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>{paymentMethod === "safepay" || codUsesSafepayAdvance ? "Connecting to SafePay..." : "Placing Order..."}</span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        {paymentMethod === "safepay"
                          ? "Pay with SafePay"
                          : codUsesSafepayAdvance
                            ? "Pay Delivery Fee via SafePay"
                            : "Place COD Order"}
                      </>
                    )}
                  </button>
                </div>

                {/* Security Badge */}
                <div className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 sm:text-sm">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  <span>256-bit SSL encrypted checkout powered by SafePay</span>
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
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 sm:gap-3"
                  >
                    <img
                      src={getCheckoutItemImage(item)}
                      alt={item.name}
                      className="h-14 w-14 flex-shrink-0 rounded-lg bg-white object-contain p-1.5 ring-1 ring-slate-100 sm:h-16 sm:w-16"
                      onError={(event) => {
                        event.currentTarget.src =
                          "/images/products/honey.webp";
                      }}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                      <h4 className="break-words text-sm font-semibold leading-5 text-slate-800">
                        {item.name}
                      </h4>
                      <p className="text-[1.05rem] font-semibold leading-5 text-emerald-700 sm:text-base">
                        {formatPrice(
                          getCheckoutUnitPrice(item) * item.quantity,
                          settings.currency,
                        )}
                      </p>
                      {/* Quantity controls */}
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => updateQuantity(item.product_id ?? item.id, Math.max(1, item.quantity - 1))}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-semibold text-slate-700 w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product_id ?? item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                          aria-label="Increase quantity"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product_id ?? item.id)}
                      className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-500 transition-colors self-center"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="space-y-3 border-t border-slate-200 pt-4 sm:space-y-4">
                {/* Coupon Input — hidden while a store-wide sale is active
                    (sale and coupons cannot be combined) */}
                {storeSaleActive ? (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-700 sm:text-sm">
                    <Tag className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-500" />
                    <span>
                      <span className="font-semibold">{settings.storeDiscountLabel} is live</span> —
                      a {Math.round(Number(settings.storeDiscountPercentage) || 0)}% discount is already
                      applied to every item. Coupon codes can’t be combined with the sale.
                    </span>
                  </div>
                ) : (
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
                )}

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
                          {storeSaleActive
                            ? `${settings.storeDiscountLabel} (${Math.round(Number(settings.storeDiscountPercentage) || 0)}%)`
                            : `Discount (${appliedCoupon?.code})`}
                        </span>
                      </span>
                      <span className="ml-2 flex-shrink-0">
                        -{formatPrice(discount, settings.currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm text-slate-600 sm:text-base">
                    <span>Shipping</span>
                    <div className="flex flex-col items-end gap-0.5">
                      {hasDeliveryFee ? (
                        isShippingFree ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-emerald-600 line-through text-xs opacity-60">
                              {formatPrice(parseInt(selectedCityData?.fee, 10) || 0, settings.currency)}
                            </span>
                            <span className="font-bold text-emerald-600">Free</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium whitespace-nowrap">
                              🎉 Free delivery
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-emerald-700">
                                {formatPrice(deliveryFee, settings.currency)}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium whitespace-nowrap">
                                📦 Delivery to {shippingData.city}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Free with online payment (SafePay) on orders of {formatPrice(freeShippingThreshold, settings.currency)}+
                            </span>
                          </div>
                        )
                      ) : (
                        <span className="font-semibold text-slate-400">—</span>
                      )}
                    </div>
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
              to="/shipping"
              className="transition-colors duration-200 hover:text-emerald-700"
            >
              Shipping
            </Link>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <Link
              to="/returns"
              className="transition-colors duration-200 hover:text-emerald-700"
            >
              Returns
            </Link>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
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
    </>
  );
}
