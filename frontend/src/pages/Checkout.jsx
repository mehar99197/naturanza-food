import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
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
import { formatPrice } from "@/lib/utils";
import api, { paymentAPI, settingsAPI, cartAPI } from "@/services/api";
import { NoIndexSEO } from "@/components/SEO";

const http = api.axiosInstance;

const STORAGE_KEY = "naturanza_checkout_shipping";
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Checkout() {
  const { items, totalPrice, clearCart, updateQuantity, removeItem, loading: cartLoading, error: cartError, fetchCart } = useCart();
  const { addOrder } = useOrders();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { settings } = useSettings();
  const supportEmail = settings.storeEmail || "support@naturanzafood.com";
  const [step, setStep] = useState("shipping");
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [confirmedAdvanceFee, setConfirmedAdvanceFee] = useState(0);
  const [confirmedPayOnDeliveryAmount, setConfirmedPayOnDeliveryAmount] =
    useState(0);

  // Payment popup state
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [paymentPopupMethod, setPaymentPopupMethod] = useState("");

  // Verification step payment method (for COD)
  const [verificationPaymentMethod, setVerificationPaymentMethod] = useState("");

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
  const cartLoadStartedRef = useRef(false);

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
      cartLoadStartedRef.current = true;
      loadingTimer = setTimeout(() => {
        setShowCartLoading(true);
      }, 300);
    } else {
      setShowCartLoading(false);
      if (cartLoadStartedRef.current || items.length > 0) {
        setCartHydrated(true);
      }
    }

    return () => {
      if (loadingTimer) {
        clearTimeout(loadingTimer);
      }
    };
  }, [authLoading, isAuthenticated, cartLoading, items.length]);

  // Fetch available coupons
  useEffect(() => {
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
  const [shippingData, setShippingData] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      postalCode: "",
    };
  });

  // Field validation state (touched = user left field)
  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldValid, setFieldValid] = useState({});

  // Save shipping data to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && step === "shipping") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(shippingData));
      } catch {}
    }
  }, [shippingData, step]);

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
  const [copiedType, setCopiedType] = useState(null); // null | 'jazzcash' | 'easypaisa'
  const [activePaymentAccounts, setActivePaymentAccounts] = useState([]);
  const [paymentAccountsLoaded, setPaymentAccountsLoaded] = useState(false);

  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState("jazzcash");
  const [verificationFile, setVerificationFile] = useState(null);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [tidError, setTidError] = useState("");

  const TID_REGEX = /^\d{11}$/;
  const isWalletMethod = (m) => m === "jazzcash" || m === "easypaisa";
  const validateTid = (value, method) => {
    if (!isWalletMethod(method)) return "";
    const trimmed = (value || "").trim();
    if (!trimmed) return "Transaction ID is required for JazzCash/EasyPaisa.";
    if (!TID_REGEX.test(trimmed)) return "TID must be exactly 11 digits.";
    return "";
  };

  // COD Advance Payment state
  const [codAdvanceMethod, setCodAdvanceMethod] = useState("jazzcash");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [shippingCities, setShippingCities] = useState([]);
  const [shippingCitiesLoading, setShippingCitiesLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadPaymentAccounts = async () => {
      if (!user) {
        if (isMounted) {
          setActivePaymentAccounts([]);
          setPaymentAccountsLoaded(true);
        }
        return;
      }

      try {
        const response = await paymentAPI.getActiveAccounts();
        if (isMounted) {
          setActivePaymentAccounts(Array.isArray(response) ? response : []);
        }
      } catch (error) {
        if (isMounted) {
          setActivePaymentAccounts([]);
        }
      } finally {
        if (isMounted) {
          setPaymentAccountsLoaded(true);
        }
      }
    };

    loadPaymentAccounts();

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Fetch WhatsApp number (falls back to settings context if API fails)
  useEffect(() => {
    let isMounted = true;
    const loadWhatsAppNumber = async () => {
      try {
        const response = await settingsAPI.getWhatsAppNumber();
        if (isMounted && response?.whatsappNumber) {
          setWhatsappNumber(response.whatsappNumber.replace(/\D/g, ""));
        }
      } catch (error) {
        // Fall back to the value already available via SettingsContext.
        // Admin owns the number end-to-end — no hardcoded fallback.
        if (isMounted) {
          const contextNumber =
            String(settings.whatsappNumber || settings.storePhone || "").replace(/\D/g, "");
          setWhatsappNumber(contextNumber);
        }
      }
    };
    loadWhatsAppNumber();
    return () => {
      isMounted = false;
    };
  }, [settings.whatsappNumber, settings.storePhone]);

  // Fetch active shipping cities
  useEffect(() => {
    let isMounted = true;
    const loadShippingCities = async () => {
      try {
        const response = await http.get("/shipping/city-fees/active");
        if (isMounted) {
          setShippingCities(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
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

  const activeAccountsByType = useMemo(() => {
    const map = new Map();
    activePaymentAccounts.forEach((account) => {
      const key = String(account.type || "").trim().toLowerCase();
      if (key) {
        map.set(key, account);
      }
    });
    return map;
  }, [activePaymentAccounts]);

  const verificationMethodOptions = useMemo(() => {
    const allowed = new Set(["jazzcash", "easypaisa", "bank"]);
    const options = activePaymentAccounts
      .map((account) => {
        const type = String(account.type || "").trim().toLowerCase();
        if (!allowed.has(type)) return null;
        return {
          value: type,
          label:
            type === "jazzcash"
              ? "JazzCash"
              : type === "easypaisa"
                ? "EasyPaisa"
                : "Bank Transfer",
        };
      })
      .filter(Boolean);

    if (options.length > 0) {
      return options;
    }

    return [
      { value: "jazzcash", label: "JazzCash" },
      { value: "easypaisa", label: "EasyPaisa" },
      { value: "bank", label: "Bank Transfer" },
    ];
  }, [activePaymentAccounts]);

  const defaultVerificationMethod = useMemo(() => {
    if (paymentMethod === "easypaisa" || paymentMethod === "jazzcash") {
      return paymentMethod;
    }

    if (paymentMethod === "cod" && codAdvanceMethod) {
      return codAdvanceMethod;
    }

    return verificationMethodOptions[0]?.value || "jazzcash";
  }, [paymentMethod, codAdvanceMethod, verificationMethodOptions]);

  useEffect(() => {
    if (defaultVerificationMethod && defaultVerificationMethod !== verificationMethod) {
      setVerificationMethod(defaultVerificationMethod);
    }
  }, [defaultVerificationMethod, verificationMethod]);


  const handleShippingChange = (e) => {
    const { name, value } = e.target;
    // Clear validation for this field on change
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

  const handleCopyAccountNumber = async (accountNumber, type) => {
    if (!accountNumber) return;
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopiedType(type);
    } catch (copyError) {}
  };

  const handlePaymentMethodSelect = (method) => {
    setPaymentMethod(method);
    if (method === "easypaisa" || method === "jazzcash") {
      setPaymentPopupMethod(method);
      setShowPaymentPopup(true);
    }
  };

  const openVerificationModal = () => {
    setVerificationError("");
    setVerificationSuccess("");
    setVerificationFile(null);
    setVerificationMethod(defaultVerificationMethod);
    setTransactionId("");
    setTidError("");
    setShowVerificationModal(true);
  };

  const closeVerificationModal = () => {
    setShowVerificationModal(false);
  };

  const handleVerificationFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setVerificationFile(file);
    if (file) {
      setVerificationError("");
    }
  };

  const handleSubmitVerification = async (event) => {
    event?.preventDefault();

    if (!orderId) {
      setVerificationError("Order id is missing. Please refresh and try again.");
      return;
    }

    if (!verificationMethod) {
      setVerificationError("Please select a payment method.");
      return;
    }

    if (!verificationAmount || verificationAmount <= 0) {
      setVerificationError("Invalid payment amount.");
      return;
    }

    if (!verificationFile) {
      setVerificationError("Please upload a payment screenshot.");
      return;
    }

    const tidValidation = validateTid(transactionId, verificationMethod);
    if (tidValidation) {
      setTidError(tidValidation);
      setVerificationError(tidValidation);
      return;
    }

    setVerificationSubmitting(true);
    setVerificationError("");

    try {
      const formData = new FormData();
      formData.append("order_id", String(orderId));
      formData.append("customer_name", customerFullName);
      formData.append("customer_phone", shippingData.phone || "");
      formData.append("amount", String(Math.round(Number(verificationAmount))));
      formData.append("payment_method", verificationMethod);
      formData.append("verification_screenshot", verificationFile);
      if (transactionId.trim()) {
        formData.append("transaction_id", transactionId.trim());
      }

      await paymentAPI.submitVerification(formData);

      setVerificationSuccess(
        "Payment verification submitted. We will confirm shortly.",
      );
      setShowVerificationModal(false);
    } catch (submitError) {
      setVerificationError(
        submitError?.response?.data?.message ||
          submitError?.response?.data?.error ||
          "Failed to submit verification. Please try again.",
      );
    } finally {
      setVerificationSubmitting(false);
    }
  };

  const getWhatsAppMessage = () => {
    const formatAmount = (value) => formatPrice(value, settings.currency);
    if (paymentMethod === "cod") {
      const amount = confirmedAdvanceFee || deliveryFee;
      const codLabel =
        codAdvanceMethod === "easypaisa" ? "EasyPaisa" : "JazzCash";
      const message = `Assalam o Alaikum! My Order #${orderNumber} has been placed. I am sending ${formatAmount(amount)} advance payment via ${codLabel}. Please confirm my order.`;
      return encodeURIComponent(message);
    }

    if (paymentMethod === "easypaisa" || paymentMethod === "jazzcash") {
      const amount = confirmedTotal || finalTotal;
      const message = `Assalam o Alaikum! My Order #${orderNumber} has been placed. I have sent full payment of ${formatAmount(amount)} via ${paymentMethodLabel}. I will send the payment screenshot now. Please confirm my order.`;
      return encodeURIComponent(message);
    }

    return encodeURIComponent(
      `Assalam o Alaikum! My Order #${orderNumber} has been placed. Please confirm my order.`,
    );
  };

  const handleWhatsAppClick = () => {
    if (!whatsappNumber || !orderNumber) return;
    const message = getWhatsAppMessage();
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, "_blank");
  };

  useEffect(() => {
    if (!copiedType) return;

    const timer = setTimeout(() => {
      setCopiedType(null);
    }, 2000);

    return () => clearTimeout(timer);
  }, [copiedType]);


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
  const selectedCityData = shippingCities.find(c => c.city_name === shippingData.city);
  const deliveryFee = selectedCityData ? parseInt(selectedCityData.fee, 10) || 0 : 0;
  const hasDeliveryFee = selectedCityData !== undefined;
  const finalTotal = subtotal - discount + deliveryFee;
  const payOnDeliveryAmount = Math.max(0, subtotal - discount);
  const verificationAmount =
    paymentMethod === "cod"
      ? confirmedAdvanceFee || deliveryFee
      : confirmedTotal || finalTotal;
  const selectedPaymentAccount = activeAccountsByType.get(paymentMethod);
  const paymentMethodLabel =
    paymentMethod === "easypaisa"
      ? "EasyPaisa"
      : paymentMethod === "jazzcash"
        ? "JazzCash"
        : paymentMethod;
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
  const canPlaceOrder = isCartReady && items.length > 0 && !isProcessing;
  const getCheckoutItemKey = (item) => item.product_id ?? item.id ?? item.name;
  const getCheckoutItemImage = (item) =>
    item.image_url || item.image || "/images/products/honey.webp";
  const getCheckoutUnitPrice = (item) => item.final_price ?? item.price;
  const customerFullName =
    `${shippingData.firstName} ${shippingData.lastName}`.trim() ||
    user?.name ||
    "Customer";

  const handlePlaceOrder = async () => {
    // For all offline payments (cod, easypaisa, jazzcash), go to verification step first
    if (["cod", "easypaisa", "jazzcash"].includes(paymentMethod)) {
      // Initialize verification payment method
      if (paymentMethod === "cod") {
        setVerificationPaymentMethod(codAdvanceMethod || "jazzcash");
      } else {
        setVerificationPaymentMethod(paymentMethod);
      }
      setStep("verification");
      return;
    }

    setIsProcessing(true);
    setError("");

    // Verify cart directly from backend before creating order
    try {
      const cartResponse = await cartAPI.get();
      const fetchedItems = Array.isArray(cartResponse.items) ? cartResponse.items : [];
      if (fetchedItems.length === 0) {
        setError("Your cart is empty. Please add items before placing an order.");
        setIsProcessing(false);
        return;
      }
    } catch (cartErr) {
      // If we can't fetch cart, assume it's empty or has an issue
      setError("Unable to verify cart. Please refresh the page and try again.");
      setIsProcessing(false);
      return;
    }

    // Validate minimum order amount
    if (subtotal < 1) {
      setError(`Order subtotal must be at least ${formatPrice(1, settings.currency)} to place an order.`);
      setIsProcessing(false);
      return;
    }

    try {
      const isOfflinePayment = ["cod", "easypaisa", "jazzcash"].includes(
        paymentMethod,
      );
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
          // Non-fatal: order still creates with shippingData.address inline.
          console.warn("[checkout] address upsert failed:", addressSaveErr?.message);
        }
      }

      // Prepare order data - only include fields the backend expects
      const orderData = {
        customer_name: customerFullName,
        customer_email: shippingData.email,
        shipping_address: `${shippingData.address}, ${shippingData.city}`,
        phone: shippingData.phone,
        city: shippingData.city,
        payment_method: paymentMethod,
        payment_status: isOfflinePayment ? "pending" : "paid",
        shipping_cost: Number(deliveryFee) || 0,
        discount_amount: Number(discount) || 0,
        coupon_code: appliedCoupon?.code || null,
      };

      // Create order through backend API
      const newOrder = await addOrder(orderData);

      // Only proceed if order was actually created
      if (!newOrder || !newOrder.id) {
        throw new Error("Order creation failed - no order ID returned");
      }

      const orderNum = `ORD-${newOrder.id.toString().padStart(6, "0")}`;
      setOrderId(newOrder.id);
      setOrderNumber(orderNum);
      setConfirmedTotal(finalTotal);
      setConfirmedAdvanceFee(deliveryFee);
      setConfirmedPayOnDeliveryAmount(payOnDeliveryAmount);

      // Clear cart after order is confirmed
      setStep("confirmation");
      clearCart();
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    } catch (error) {
      // DO NOT re-fetch cart on order failure - this would clear the local cart if backend cart was already empty
      // The backend returns "Cart is empty" if items were removed between page load and order attempt

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

  // Verification step for offline payments (COD, EasyPaisa, JazzCash)
  if (step === "verification") {
    // For COD, use advance fee (delivery fee); for others, use full total
    const verificationTotal = paymentMethod === "cod" ? (confirmedAdvanceFee || deliveryFee) : (confirmedTotal || finalTotal);
    const selectedVerificationAccount = activeAccountsByType.get(verificationPaymentMethod);
    const isCod = paymentMethod === "cod";
    const verificationMethodLabel = verificationPaymentMethod === "easypaisa" ? "EasyPaisa" : "JazzCash";

    const handleSubmitVerificationAndOrder = async () => {
      if (!verificationFile) {
        setVerificationError("Please upload a payment screenshot.");
        return;
      }

      const tidValidation = validateTid(transactionId, verificationPaymentMethod);
      if (tidValidation) {
        setTidError(tidValidation);
        setVerificationError(tidValidation);
        return;
      }

      setIsProcessing(true);
      setError("");

      // First verify cart
      try {
        const cartResponse = await cartAPI.get();
        const fetchedItems = Array.isArray(cartResponse.items) ? cartResponse.items : [];
        if (fetchedItems.length === 0) {
          setError("Your cart is empty. Please add items before placing an order.");
          setIsProcessing(false);
          return;
        }
      } catch (cartErr) {
        setError("Unable to verify cart. Please refresh the page and try again.");
        setIsProcessing(false);
        return;
      }

      if (subtotal < 1) {
        setError(`Order subtotal must be at least ${formatPrice(1, settings.currency)} to place an order.`);
        setIsProcessing(false);
        return;
      }

      try {
        // Create the order if we haven't yet. On retry after a failed
        // verification upload we re-use the same orderId so we don't create
        // duplicate orders.
        let activeOrderId = orderId;

        if (!activeOrderId) {
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
              const addressResponse = await api.userAPI.upsertDefaultAddress(defaultAddressPayload);
              if (addressResponse?.address?.id) {
                setSelectedAddressId(addressResponse.address.id);
              }
            } catch (addressSaveErr) {
              // Non-fatal: order still creates with shippingData.address inline.
              console.warn("[checkout] address upsert failed:", addressSaveErr?.message);
            }
          }

          const orderData = {
            customer_name: customerFullName,
            customer_email: shippingData.email,
            shipping_address: `${shippingData.address}, ${shippingData.city}`,
            phone: shippingData.phone,
            city: shippingData.city,
            payment_method: paymentMethod,
            payment_status: "pending",
            // Server recomputes the subtotal from cart prices, but it stores
            // these values as-is. The verification step later reads
            // shipping_cost off the order, so it MUST be non-zero for COD.
            shipping_cost: Number(deliveryFee) || 0,
            discount_amount: Number(discount) || 0,
            coupon_code: appliedCoupon?.code || null,
          };

          const newOrder = await addOrder(orderData);

          if (!newOrder || !newOrder.id) {
            throw new Error("Order creation failed - no order ID returned");
          }

          activeOrderId = newOrder.id;
          const orderNum = `ORD-${newOrder.id.toString().padStart(6, "0")}`;
          setOrderId(newOrder.id);
          setOrderNumber(orderNum);
          setConfirmedTotal(isCod ? finalTotal : verificationTotal);
          setConfirmedAdvanceFee(isCod ? verificationTotal : 0);
          setConfirmedPayOnDeliveryAmount(isCod ? Math.max(0, subtotal - discount) : 0);
        }

        // Now submit the payment verification
        const formData = new FormData();
        formData.append("order_id", String(activeOrderId));
        formData.append("customer_name", customerFullName);
        formData.append("customer_phone", shippingData.phone || "");
        formData.append("amount", String(Math.round(Number(verificationTotal))));
        formData.append("payment_method", verificationPaymentMethod);
        formData.append("verification_screenshot", verificationFile);
        if (transactionId.trim()) {
          formData.append("transaction_id", transactionId.trim());
        }

        await paymentAPI.submitVerification(formData);

        // Clear cart and go to confirmation
        setStep("confirmation");
        clearCart();
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
      } catch (submitError) {
        const statusCode = Number(submitError?.response?.status || 0);
        // Backend payload shape varies: order routes return { error }, payment
        // verification route returns { message }. Read both.
        const backendMessage =
          submitError?.response?.data?.error ||
          submitError?.response?.data?.message ||
          "";
        const errorMessage = String(backendMessage || submitError?.message || "").toLowerCase();

        if (statusCode === 401 || statusCode === 403 || errorMessage.includes("token") || errorMessage.includes("unauthorized")) {
          setError("Your session has expired. Please login again to continue.");
        } else if (!submitError?.response) {
          setError("Unable to connect to server. Please check your internet connection and try again.");
        } else {
          setError(backendMessage || "Failed to place order. Please try again.");
        }
      } finally {
        setIsProcessing(false);
      }
    };

    return (
      <>
        <NoIndexSEO title="Payment Verification - Naturanza Food" />
        <div className="container-custom max-w-2xl pt-8 sm:pt-12 px-4">
          <div className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.1)] backdrop-blur sm:p-8 md:p-10">
            {/* Header */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="mx-auto mb-4 inline-flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30">
                <CreditCard className="h-8 w-8 sm:h-10 sm:w-10" />
              </div>
              <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {isCod ? "Delivery Fee Advance Payment" : "Payment Verification Required"}
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                {isCod
                  ? `Pay ${formatPrice(verificationTotal, settings.currency)} delivery fee in advance to confirm your order. The remaining ${formatPrice(Math.max(0, (confirmedTotal || finalTotal) - verificationTotal), settings.currency)} will be collected as cash on delivery.`
                  : "Please upload your payment screenshot to confirm your order."}
              </p>
            </div>

            {/* Payment Details Card */}
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                  <span className="text-lg">💰</span>
                  Amount to Pay
                </h2>
                <span className="text-xl sm:text-2xl font-bold text-emerald-700">
                  {formatPrice(verificationTotal, settings.currency)}
                </span>
              </div>

              {/* Show both accounts for COD, single account for others */}
              {isCod ? (
                <div className="space-y-3">
                  {/* JazzCash Option */}
                  {activeAccountsByType.get("jazzcash") && (
                    <div
                      className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                        verificationPaymentMethod === "jazzcash"
                          ? "border-rose-400 bg-rose-50"
                          : "border-emerald-200 bg-white hover:border-emerald-300"
                      }`}
                      onClick={() => setVerificationPaymentMethod("jazzcash")}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <img src="/images/payment%20logos/jazzcash.png" alt="JazzCash" className="w-8 h-8 object-contain" />
                          <span className="font-semibold text-gray-900">JazzCash</span>
                        </div>
                        {verificationPaymentMethod === "jazzcash" && (
                          <span className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full">Selected</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-gray-900">{activeAccountsByType.get("jazzcash").account_number}</p>
                          <p className="text-xs text-gray-500">{activeAccountsByType.get("jazzcash").account_name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyAccountNumber(activeAccountsByType.get("jazzcash").account_number, "jazzcash");
                          }}
                          className="rounded px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          {copiedType === "jazzcash" ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* EasyPaisa Option */}
                  {activeAccountsByType.get("easypaisa") && (
                    <div
                      className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
                        verificationPaymentMethod === "easypaisa"
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-emerald-200 bg-white hover:border-emerald-300"
                      }`}
                      onClick={() => setVerificationPaymentMethod("easypaisa")}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <img src="/images/payment%20logos/easypaisa.png" alt="EasyPaisa" className="w-8 h-8 object-contain" />
                          <span className="font-semibold text-gray-900">EasyPaisa</span>
                        </div>
                        {verificationPaymentMethod === "easypaisa" && (
                          <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full">Selected</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-bold text-gray-900">{activeAccountsByType.get("easypaisa").account_number}</p>
                          <p className="text-xs text-gray-500">{activeAccountsByType.get("easypaisa").account_name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyAccountNumber(activeAccountsByType.get("easypaisa").account_number, "easypaisa");
                          }}
                          className="rounded px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          {copiedType === "easypaisa" ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Fallback if no accounts */}
                  {!activeAccountsByType.get("jazzcash") && !activeAccountsByType.get("easypaisa") && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-600">Please contact support for payment details</p>
                    </div>
                  )}
                </div>
              ) : (
                // Single account for non-COD
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm text-gray-600">Account Number:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-semibold text-gray-900">
                        {selectedVerificationAccount?.account_number || "N/A"}
                      </span>
                      {selectedVerificationAccount?.account_number && (
                        <button
                          type="button"
                          onClick={() => handleCopyAccountNumber(selectedVerificationAccount.account_number, paymentMethod)}
                          className="rounded px-2 py-1 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          {copiedType === paymentMethod ? "Copied!" : "Copy"}
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedVerificationAccount?.account_name && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm text-gray-600">Account Name:</span>
                      <span className="text-sm sm:text-base font-medium text-gray-800">
                        {selectedVerificationAccount.account_name}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-emerald-200">
                <p className="text-xs text-emerald-700 font-medium">
                  💡 Please send {formatPrice(verificationTotal, settings.currency)} to your selected account, then upload your payment screenshot below.
                </p>
              </div>
            </div>

            {/* Transaction ID Input — required for JazzCash/EasyPaisa */}
            {isWalletMethod(verificationPaymentMethod) && (
              <div className="mb-6">
                <label htmlFor="tid-input-step" className="block text-sm font-semibold text-gray-800 mb-3">
                  Transaction ID (TID) *
                </label>
                <input
                  id="tid-input-step"
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  autoComplete="off"
                  value={transactionId}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 11);
                    setTransactionId(digitsOnly);
                    setTidError(validateTid(digitsOnly, verificationPaymentMethod));
                  }}
                  placeholder="11-digit TID from your payment app"
                  aria-invalid={Boolean(tidError)}
                  aria-describedby={tidError ? "tid-input-step-error" : undefined}
                  className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {tidError ? (
                  <p id="tid-input-step-error" className="mt-1 text-xs text-red-600">{tidError}</p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    Find this on your JazzCash/EasyPaisa transaction receipt.
                  </p>
                )}
              </div>
            )}

            {/* Screenshot Upload */}
            <div className="mb-6">
              <label htmlFor="payment-screenshot" className="block text-sm font-semibold text-gray-800 mb-3">
                Upload Payment Screenshot *
              </label>
              <input
                id="payment-screenshot"
                type="file"
                accept="image/*"
                onChange={handleVerificationFileChange}
                className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
              />
              {verificationFile && (
                <p className="mt-2 text-sm text-emerald-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Selected: {verificationFile.name}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Make sure the screenshot clearly shows the transaction details.
              </p>
            </div>

            {/* Order Summary */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Order Summary</h3>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-medium text-gray-800">{items.length} item(s)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium text-gray-800">{formatPrice(subtotal - discount, settings.currency)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount:</span>
                    <span className="font-medium text-emerald-600">-{formatPrice(discount, settings.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-gray-600 font-semibold">Order Total:</span>
                  <span className="font-bold text-gray-800">{formatPrice(finalTotal, settings.currency)}</span>
                </div>
                {isCod && (
                  <>
                    <div className="flex justify-between bg-emerald-50 p-2 rounded-lg mt-2">
                      <span className="text-emerald-700 font-medium">Advance Paid:</span>
                      <span className="font-bold text-emerald-700">{formatPrice(verificationTotal, settings.currency)}</span>
                    </div>
                    <div className="flex justify-between bg-amber-50 p-2 rounded-lg">
                      <span className="text-amber-700 font-medium">Pending (COD):</span>
                      <span className="font-bold text-amber-700">{formatPrice(Math.max(0, finalTotal - verificationTotal), settings.currency)}</span>
                    </div>
                  </>
                )}
                {!isCod && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-semibold">Total:</span>
                    <span className="font-bold text-emerald-700">{formatPrice(verificationTotal, settings.currency)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              </div>
            )}

            {verificationError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{verificationError}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={() => setStep("payment")}
                disabled={isProcessing}
                className="flex-1 h-12 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-60"
              >
                Back to Payment
              </button>
              <button
                onClick={handleSubmitVerificationAndOrder}
                disabled={isProcessing || !verificationFile}
                className={`flex-1 h-12 rounded-xl px-5 text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 ${checkoutPrimaryButtonToneClass}`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Upload & Place Order
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              Your order will be placed after payment verification is uploaded.
            </p>
          </div>
        </div>
      </>
    );
  }

  if (step === "confirmation") {
    return (
      <>
        <NoIndexSEO title="Order Confirmed - Naturanza Food" />
        <div className="container-custom max-w-2xl pt-8 sm:pt-12">
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
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 mb-1">Total Amount</p>
                  <p className="font-bold text-lg sm:text-xl text-green-600">
                    {formatPrice(confirmedTotal, settings.currency)}
                  </p>
                  {discount > 0 && (
                    <p className="text-xs text-gray-500">
                      <span className="line-through">
                        {formatPrice(confirmedTotal + discount, settings.currency)}
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
                {paymentMethod === "cod" && (
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Payment Status</p>
                    <p className="font-semibold text-sm sm:text-base text-gray-900">
                      Pending (COD balance)
                    </p>
                  </div>
                )}
                {paymentMethod === "cod" && (
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-1">Remaining COD</p>
                    <p className="font-semibold text-sm sm:text-base text-gray-900">
                      {formatPrice(
                        confirmedPayOnDeliveryAmount || payOnDeliveryAmount,
                        settings.currency,
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Status */}
            <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:mb-8 sm:p-4">
              <p className="text-xs sm:text-sm text-blue-900">
                📧 A confirmation email has been sent to{" "}
                <span className="font-semibold">{shippingData.email}</span>
              </p>
            </div>

            {paymentMethod === "cod" && (
              <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-left sm:mb-8 sm:p-6">
                <p className="text-xs font-semibold text-amber-700 sm:text-sm">
                  ⚠️ Advance payment of{" "}
                  {formatPrice(confirmedAdvanceFee, settings.currency)} is
                  required after placing order, otherwise your order will be
                  cancelled.
                </p>
                <div className="mt-4 pt-4 border-t border-amber-200">
                  <button
                    type="button"
                    onClick={handleWhatsAppClick}
                    disabled={!orderNumber || !whatsappNumber}
                    className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      orderNumber && whatsappNumber
                        ? "bg-emerald-500 text-white hover:bg-emerald-600"
                        : "bg-slate-200 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.162-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Confirm Advance Payment on WhatsApp
                  </button>
                </div>
              </div>
            )}

            {(paymentMethod === "easypaisa" || paymentMethod === "jazzcash") && (
              <div className="mb-6 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 text-left sm:mb-8 sm:p-6">
                <p className="text-xs font-semibold text-emerald-700 sm:text-sm">
                  ✅ Please confirm your {paymentMethodLabel} payment on WhatsApp.
                </p>
                <div className="mt-4 pt-4 border-t border-emerald-200">
                  <button
                    type="button"
                    onClick={handleWhatsAppClick}
                    disabled={!orderNumber || !whatsappNumber}
                    className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      orderNumber && whatsappNumber
                        ? "bg-emerald-500 text-white hover:bg-emerald-600"
                        : "bg-slate-200 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.162-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Confirm Payment on WhatsApp
                  </button>
                </div>
              </div>
            )}


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
                    <div className="relative">
                      <input
                        type="text"
                        name="fullName"
                        value={`${shippingData.firstName} ${shippingData.lastName}`.trim()}
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
                  </div>
                  {fieldErrors.address && (
                    <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.address}</p>
                  )}
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
                  <img src="/images/payment%20logos/easypaisa.png" alt="Easypaisa" className="h-7 w-auto object-contain opacity-80" />
                  <img src="/images/payment%20logos/jazzcash.png" alt="JazzCash" className="h-7 w-auto object-contain opacity-80" />
                  <img src="/images/payment%20logos/cash-on-delivery.png" alt="COD" className="h-7 w-auto object-contain opacity-80" />
                </div>
                <div className="flex items-center gap-2 justify-center mb-3">
                  <Lock className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-xs font-medium text-emerald-700">100% Secure Checkout</span>
                </div>

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
                      onChange={(e) => handlePaymentMethodSelect(e.target.value)}
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
                      onChange={(e) => handlePaymentMethodSelect(e.target.value)}
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

                </div>

                {/* Conditional Payment Fields */}


                {(paymentMethod === "easypaisa" || paymentMethod === "jazzcash") && (
                  <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4 sm:mb-6 sm:p-6">
                    <h3 className="mb-2 text-sm font-semibold text-slate-800 sm:text-base">
                      {paymentMethodLabel} payment details
                    </h3>
                    <p className="mb-4 text-xs font-semibold text-emerald-700 sm:text-sm">
                      Full payment of {formatPrice(finalTotal, settings.currency)} is required after placing the order.
                    </p>
                    <div className="space-y-2.5 rounded-xl border border-emerald-200 bg-white/80 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                        <span className="font-semibold text-slate-800">
                          Send to {paymentMethodLabel}:
                        </span>
                        <span className="text-slate-700">
                          {selectedPaymentAccount?.account_number || "Contact support for account details"}
                        </span>
                        {selectedPaymentAccount?.account_number && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyAccountNumber(
                                selectedPaymentAccount.account_number,
                                paymentMethod,
                              )
                            }
                            className={`rounded px-3 py-1 text-xs font-semibold ${checkoutPrimaryButtonToneClass}`}
                          >
                            {copiedType === paymentMethod ? "Copied ✓" : "Copy Number"}
                          </button>
                        )}
                      </div>
                      {selectedPaymentAccount?.account_name && (
                        <p className="text-xs text-slate-500">
                          {selectedPaymentAccount.account_name}
                        </p>
                      )}
                      <p className="text-xs text-slate-600">
                        After payment, please send your screenshot on WhatsApp to confirm.
                      </p>
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
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 sm:h-12 sm:flex-1"
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

          {/* Payment Details Popup */}
          {showPaymentPopup && typeof document !== "undefined" &&
            createPortal(
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setShowPaymentPopup(false);
                  }
                }}
              >
                <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={`/images/payment%20logos/${paymentPopupMethod}.png`}
                        alt={paymentPopupMethod === "easypaisa" ? "EasyPaisa" : "JazzCash"}
                        className="w-8 h-8 object-contain"
                      />
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          {paymentPopupMethod === "easypaisa" ? "EasyPaisa" : "JazzCash"} Payment Details
                        </h3>
                        <p className="text-xs text-slate-500">
                          Copy the number and send payment
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPaymentPopup(false)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                      <p className="text-xs font-medium text-emerald-700 mb-3">
                        💰 Send {formatPrice(finalTotal, settings.currency)} to:
                      </p>
                      {activeAccountsByType.get(paymentPopupMethod) ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-600">Account Number:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-slate-900">
                                {activeAccountsByType.get(paymentPopupMethod).account_number}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  handleCopyAccountNumber(activeAccountsByType.get(paymentPopupMethod).account_number, paymentPopupMethod);
                                }}
                                className="rounded px-2 py-1 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                {copiedType === paymentPopupMethod ? "Copied!" : "Copy"}
                              </button>
                            </div>
                          </div>
                          {activeAccountsByType.get(paymentPopupMethod).account_name && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-600">Account Name:</span>
                              <span className="text-sm font-medium text-slate-800">
                                {activeAccountsByType.get(paymentPopupMethod).account_name}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600">Contact support for payment details</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                      <p className="text-xs font-medium text-amber-700">
                        ⚠️ After sending payment, click "Place Order" and upload your payment screenshot to confirm your order.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowPaymentPopup(false)}
                      className="w-full rounded-xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:from-emerald-600 hover:to-green-700"
                    >
                      Got it, I will send payment
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )}

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
                      onClick={() => removeItem(item.product_id ?? item.id)}
                      className="flex-shrink-0 p-1.5 text-slate-400 hover:text-red-500 transition-colors self-center"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                    <div className="flex flex-col items-end gap-0.5">
                      {hasDeliveryFee ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-emerald-700">
                            {formatPrice(deliveryFee, settings.currency)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium whitespace-nowrap">
                            📦 Delivery to {shippingData.city}
                          </span>
                        </div>
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
