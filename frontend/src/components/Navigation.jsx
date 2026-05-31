import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Heart,
  Menu,
  X,
  User,
  Search,
  TrendingUp,
  LogOut,
  UserCircle,
  Home,
  ShoppingBag,
  Info,
  MessageCircle,
  HelpCircle,
  Truck,
  RotateCcw,
  Shield,
  FileText,
  ChevronRight,
  Settings,
  Package,
  Bell,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { userAPI } from "@/services/api";

const resolveUserImage = (user, fallbackImage) => {
  return (
    user?.profile_image ||
    user?.profileImage ||
    user?.avatar ||
    fallbackImage ||
    null
  );
};

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [isCartBadgePulsing, setIsCartBadgePulsing] = useState(false);
  const [isCartIconBumping, setIsCartIconBumping] = useState(false);
  const [isWishlistBadgePulsing, setIsWishlistBadgePulsing] = useState(false);
  const [isWishlistIconBumping, setIsWishlistIconBumping] = useState(false);
  const [isAuthResolvedVisible, setIsAuthResolvedVisible] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [activeNavIndicator, setActiveNavIndicator] = useState({
    left: 0,
    width: 0,
    opacity: 0,
  });
  const [isNavIndicatorReady, setIsNavIndicatorReady] = useState(false);
  const [hoveredNavPath, setHoveredNavPath] = useState(null);
  const desktopNavRef = useRef(null);
  const desktopLinkRefs = useRef({});
  const userMenuRef = useRef(null);
  const previousTotalItemsRef = useRef(0);
  const previousWishlistTotalItemsRef = useRef(0);
  const hasInitializedWishlistCountRef = useRef(false);
  const { totalItems, setIsCartOpen } = useCart();
  const { totalItems: wishlistTotalItems } = useWishlist();
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const resolvedProfileImage = imageLoadFailed
    ? null
    : resolveUserImage(user, profileImage);
  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    "U";
  const cartBadgeLabel = totalItems > 99 ? "99+" : String(totalItems);
  const wishlistBadgeLabel =
    wishlistTotalItems > 99 ? "99+" : String(wishlistTotalItems);
  const isAuthHydrating = loading && !user;

  const popularSearches = [
    "Honey",
    "Herbal Oil",
    "Green Tea",
    "Turmeric",
    "Organic",
  ];

  useEffect(() => {
    if (isAuthHydrating) {
      setIsAuthResolvedVisible(false);
      return;
    }

    const frameId = requestAnimationFrame(() => {
      setIsAuthResolvedVisible(true);
    });

    return () => cancelAnimationFrame(frameId);
  }, [isAuthHydrating, user?.id, user?.email]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const nextIsScrolled = currentScrollY > 24;

      setIsScrolled((prev) =>
        prev === nextIsScrolled ? prev : nextIsScrolled,
      );
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close search modal and mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        if (isSearchOpen) {
          setIsSearchOpen(false);
        }
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isSearchOpen, isMobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [isMobileMenuOpen]);

  // Fetch unread-notifications count for the bell badge.
  // Refresh on login + on route change so the badge stays in sync after
  // visiting /notifications (which marks items as read).
  useEffect(() => {
    if (!user?.id) {
      setNotifUnreadCount(0);
      return;
    }
    let cancelled = false;
    userAPI
      .getNotificationsUnreadCount()
      .then((data) => {
        if (!cancelled) {
          setNotifUnreadCount(Number(data?.count) || 0);
        }
      })
      .catch(() => {
        if (!cancelled) setNotifUnreadCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, location.pathname]);

  // Load and sync profile image from user object and localStorage
  useEffect(() => {
    const syncProfileImage = (forcedImage) => {
      if (typeof forcedImage !== "undefined") {
        if (forcedImage) {
          localStorage.setItem("profileImage", forcedImage);
        } else {
          localStorage.removeItem("profileImage");
        }

        setProfileImage(forcedImage || null);
        setImageLoadFailed(false);
        return;
      }

      const savedImage = localStorage.getItem("profileImage");
      const userImage = resolveUserImage(user, null);
      const hasUser = Boolean(user && typeof user === "object");

      if (userImage && userImage !== savedImage) {
        localStorage.setItem("profileImage", userImage);
      }

      if (!userImage && hasUser && savedImage) {
        localStorage.removeItem("profileImage");
      }

      const nextImage = userImage || (hasUser ? null : savedImage || null);

      setProfileImage(nextImage);
      setImageLoadFailed(false);
    };

    // Load on mount / user change
    syncProfileImage();

    // Listen for storage changes (from other tabs)
    const handleStorageChange = (e) => {
      if (e.key === "profileImage") {
        setProfileImage(e.newValue);
      }
    };

    // Listen for custom event for same-tab updates
    const handleProfileUpdate = (event) => {
      if (
        Object.prototype.hasOwnProperty.call(
          event?.detail || {},
          "profileImage",
        )
      ) {
        syncProfileImage(event.detail.profileImage);
        return;
      }

      syncProfileImage();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("profileImageUpdated", handleProfileUpdate);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("profileImageUpdated", handleProfileUpdate);
    };
  }, [user]);

  const handleLogout = () => {
    logout();
    setProfileImage(null);
    setImageLoadFailed(false);
    localStorage.removeItem("profileImage");
    navigate("/");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery("");
    }
  };

  const handlePopularSearch = (term) => {
    navigate(`/shop?search=${encodeURIComponent(term)}`);
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  const handleWishlistClick = () => {
    if (!user) {
      setIsMobileMenuOpen(false);
      navigate("/login", {
        state: { from: { pathname: location.pathname } },
      });
      return;
    }

    setIsMobileMenuOpen(false);
    navigate("/profile/wishlist");
  };

  const navLinks = [
    { path: "/", label: "Home", icon: Home },
    { path: "/shop", label: "Shop", icon: ShoppingBag },
    { path: "/about", label: "About", icon: Info },
    { path: "/contact", label: "Contact", icon: MessageCircle },
  ];

  const mobileQuickLinks = [
    { key: "home", path: "/", label: "Home", icon: Home, theme: "shop" },
    {
      key: "shop",
      path: "/shop",
      label: "Shop",
      icon: ShoppingBag,
      theme: "shop",
    },
    ...(user
      ? [
          {
            key: "faq",
            path: "/faq",
            label: "FAQ",
            icon: HelpCircle,
            theme: "support",
          },
        ]
      : [
          {
            key: "orders",
            path: "/orders",
            label: "Track Order",
            icon: ShoppingCart,
            theme: "account",
          },
        ]),
    {
      key: "contact",
      path: "/contact",
      label: "Contact",
      icon: MessageCircle,
      theme: "support",
    },
  ];

  const mobileSupportLinks = [
    { key: "shipping", path: "/shipping", label: "Shipping", icon: Truck },
    { key: "returns", path: "/returns", label: "Returns", icon: RotateCcw },
    { key: "privacy", path: "/privacy", label: "Privacy", icon: Shield },
    { key: "terms", path: "/terms", label: "Terms", icon: FileText },
  ];

  const quickLinkThemeClasses = {
    shop: {
      iconActive: "bg-green-100 text-green-700",
      iconIdle: "bg-green-50 text-green-600",
      cardActive: "border-green-200 bg-green-50/80",
      cardIdle: "border-green-100/70 bg-white active:bg-green-50/40",
      textActive: "text-green-900",
      chevronActive: "text-green-500",
    },
    account: {
      iconActive: "bg-emerald-100 text-emerald-700",
      iconIdle: "bg-emerald-50 text-emerald-600",
      cardActive: "border-emerald-200 bg-emerald-50/80",
      cardIdle: "border-emerald-100/70 bg-white active:bg-emerald-50/40",
      textActive: "text-emerald-900",
      chevronActive: "text-emerald-500",
    },
    support: {
      iconActive: "bg-blue-100 text-blue-700",
      iconIdle: "bg-blue-50 text-blue-600",
      cardActive: "border-blue-200 bg-blue-50/80",
      cardIdle: "border-blue-100/70 bg-white active:bg-blue-50/40",
      textActive: "text-blue-900",
      chevronActive: "text-blue-500",
    },
  };

  const isActive = (path) => location.pathname === path;

  const updateActiveNavIndicator = useCallback(() => {
    const activePath = navLinks.some((link) => link.path === location.pathname)
      ? location.pathname
      : null;
    const targetPath = hoveredNavPath || activePath;

    if (!desktopNavRef.current || !targetPath) {
      setActiveNavIndicator((prev) =>
        prev.opacity === 0 ? prev : { ...prev, opacity: 0 },
      );
      return;
    }

    const targetLink = desktopLinkRefs.current[targetPath];
    if (!targetLink) {
      setActiveNavIndicator((prev) =>
        prev.opacity === 0 ? prev : { ...prev, opacity: 0 },
      );
      return;
    }

    const linkLeft = targetLink.offsetLeft;
    const linkWidth = targetLink.offsetWidth;

    setActiveNavIndicator({
      left: linkLeft,
      width: linkWidth,
      opacity: 1,
    });

    if (!isNavIndicatorReady) {
      setIsNavIndicatorReady(true);
    }
  }, [hoveredNavPath, location.pathname]);

  useEffect(() => {
    const animationFrameId = requestAnimationFrame(updateActiveNavIndicator);
    return () => cancelAnimationFrame(animationFrameId);
  }, [updateActiveNavIndicator]);

  useEffect(() => {
    const handleResize = () => updateActiveNavIndicator();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [updateActiveNavIndicator]);

  useEffect(() => {
    const previousTotal = previousTotalItemsRef.current;
    const hasIncremented = totalItems > previousTotal;
    previousTotalItemsRef.current = totalItems;

    if (!hasIncremented || totalItems <= 0) {
      return;
    }

    setIsCartBadgePulsing(false);
    setIsCartIconBumping(false);

    const rafId = requestAnimationFrame(() => {
      setIsCartBadgePulsing(true);
      setIsCartIconBumping(true);
    });

    const timerId = setTimeout(() => {
      setIsCartBadgePulsing(false);
      setIsCartIconBumping(false);
    }, 620);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [totalItems]);

  useEffect(() => {
    if (!hasInitializedWishlistCountRef.current) {
      hasInitializedWishlistCountRef.current = true;
      previousWishlistTotalItemsRef.current = wishlistTotalItems;
      return;
    }

    const previousTotal = previousWishlistTotalItemsRef.current;
    const hasChanged = wishlistTotalItems !== previousTotal;
    previousWishlistTotalItemsRef.current = wishlistTotalItems;

    if (!hasChanged) {
      return;
    }

    setIsWishlistBadgePulsing(false);
    setIsWishlistIconBumping(false);

    const rafId = requestAnimationFrame(() => {
      setIsWishlistBadgePulsing(true);
      setIsWishlistIconBumping(true);
    });

    const timerId = setTimeout(() => {
      setIsWishlistBadgePulsing(false);
      setIsWishlistIconBumping(false);
    }, 620);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [wishlistTotalItems]);

  // Close user menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  return (
    <>
      <nav
        className={`fixed left-0 right-0 top-0 z-50 transition-[padding,background-color,box-shadow,backdrop-filter] duration-300 ease-out ${
          isScrolled
            ? "bg-white/95 shadow-lg shadow-green-100/50 py-2 md:py-2.5 backdrop-blur-xl border-b border-[#E5E7EB]"
            : "bg-white/90 backdrop-blur-sm border-b border-[#E5E7EB] py-2.5 md:py-3"
        }`}
        style={{ top: "var(--announcement-bar-height, 0px)" }}
      >
        <div className="container-custom">
          <div className="flex items-center justify-between gap-2 md:gap-0">
            {/* Logo - Optimized for mobile */}
            <Link
              to="/"
              className="flex items-center group relative flex-shrink-0"
            >
              <div
                className={`flex items-center justify-center ${
                  isScrolled
                    ? "h-8 w-auto sm:h-9 sm:w-auto md:h-9 md:w-auto"
                    : "h-9 w-auto sm:h-10 sm:w-auto md:h-11 md:w-auto"
                } transition-all duration-300 ease-out md:group-`}
              >
                <img
                  src="/images/logo.png"
                  alt="Naturanza Food"
                  className="h-full w-auto object-contain drop-shadow-lg md:group-hover:drop-shadow-2xl"
                />
              </div>
              {/* Subtle glow effect on hover */}
              <div className="absolute inset-0 bg-green-400/20 rounded-full blur-2xl opacity-0 md:group-hover:opacity-100"></div>
            </Link>

            {/* Desktop Navigation */}
            <div
              ref={desktopNavRef}
              onMouseLeave={() => setHoveredNavPath(null)}
              className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute -bottom-0.5 left-0 h-0.5 rounded-full bg-[#22C55E] ${
                  isNavIndicatorReady
                    ? "transition-[transform,width,opacity] duration-500"
                    : "transition-none"
                }`}
                style={{
                  width: `${activeNavIndicator.width}px`,
                  transform: `translateX(${activeNavIndicator.left}px)`,
                  opacity: activeNavIndicator.opacity,
                  transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  ref={(element) => {
                    if (element) {
                      desktopLinkRefs.current[link.path] = element;
                    } else {
                      delete desktopLinkRefs.current[link.path];
                    }
                  }}
                  onMouseEnter={() => setHoveredNavPath(link.path)}
                  onFocus={() => setHoveredNavPath(link.path)}
                  onBlur={() => setHoveredNavPath(null)}
                  className={`nav-link relative z-10 font-medium text-sm transition-colors duration-300 px-4 py-2 ${
                    isActive(link.path)
                      ? "text-[#14532D]"
                      : "text-[#334155] md:hover:text-[#166534]"
                  }`}
                >
                  <span className="relative z-10">{link.label}</span>
                </Link>
              ))}
            </div>

            {/* Actions - Optimized mobile layout */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Search Icon */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className={`nav-search-trigger-btn relative md:hover:bg-green-50/80 shadow-sm md:hover:shadow-md group flex-shrink-0 active:scale-95 transition-[background-color,box-shadow,transform] duration-300 ${
                  isScrolled
                    ? "p-1 sm:p-1.5 md:p-1.5 rounded-md md:rounded-lg"
                    : "p-1.5 sm:p-2 md:p-2 rounded-md md:rounded-lg"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 opacity-0 md:group-hover:opacity-100 rounded-2xl overflow-hidden"></div>
                <Search className="w-4 h-4 sm:w-5 sm:h-5 md:w-4 md:h-4 text-gray-700 md:group-hover:text-green-600 transition-colors duration-300 relative z-10" />
              </button>

              {/* Wishlist Icon */}
              <button
                onClick={handleWishlistClick}
                className={`relative md:hover:bg-green-50/80 shadow-sm md:hover:shadow-md group flex-shrink-0 active:scale-95 transition-all duration-300 ${
                  isScrolled
                    ? "p-1 sm:p-1.5 md:p-1.5 rounded-md md:rounded-lg"
                    : "p-1.5 sm:p-2 md:p-2 rounded-md md:rounded-lg"
                }`}
                aria-label="Open wishlist"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 opacity-0 md:group-hover:opacity-100 rounded-2xl overflow-hidden"></div>
                <Heart
                  className={`w-4 h-4 sm:w-5 sm:h-5 md:w-4 md:h-4 text-gray-700 md:group-hover:text-green-600 md:group-hover:scale-110 transition-all duration-300 relative z-10 origin-center ${
                    isWishlistIconBumping ? "cart-icon-bump" : ""
                  }`}
                />
                {wishlistTotalItems > 0 && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 md:-top-1 md:-right-1 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 sm:min-w-[18px] sm:h-[18px] px-1 flex items-center justify-center leading-none shadow-md ring-2 ring-white/95 z-20 transition-transform duration-200 md:group-hover:scale-105 origin-center ${
                      isWishlistBadgePulsing ? "cart-badge-pulse" : ""
                    }`}
                  >
                    {wishlistBadgeLabel}
                  </span>
                )}
              </button>

              {/* Cart Icon */}
              <button
                onClick={() => setIsCartOpen(true)}
                className={`relative md:hover:bg-green-50/80 shadow-sm md:hover:shadow-md group flex-shrink-0 active:scale-95 transition-all duration-300 ${
                  isScrolled
                    ? "p-1 sm:p-1.5 md:p-1.5 rounded-md md:rounded-lg"
                    : "p-1.5 sm:p-2 md:p-2 rounded-md md:rounded-lg"
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 opacity-0 md:group-hover:opacity-100 rounded-2xl overflow-hidden"></div>
                <ShoppingCart
                  className={`w-4 h-4 sm:w-5 sm:h-5 md:w-4 md:h-4 text-gray-700 md:group-hover:text-green-600 md:group-hover:scale-110 transition-all duration-300 relative z-10 origin-center ${isCartIconBumping ? "cart-icon-bump" : ""}`}
                />
                {totalItems > 0 && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 md:-top-1 md:-right-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 sm:min-w-[18px] sm:h-[18px] px-1 flex items-center justify-center leading-none shadow-md ring-2 ring-white/95 z-20 transition-transform duration-200 md:group-hover:scale-105 origin-center ${isCartBadgePulsing ? "cart-badge-pulse" : ""}`}
                  >
                    {cartBadgeLabel}
                  </span>
                )}
              </button>

              {/* Notifications Bell (only for logged-in users) */}
              {user && (
                <button
                  onClick={() => navigate("/notifications")}
                  aria-label="Open notifications"
                  className={`relative md:hover:bg-green-50/80 shadow-sm md:hover:shadow-md group flex-shrink-0 active:scale-95 transition-all duration-300 ${
                    isScrolled
                      ? "p-1 sm:p-1.5 md:p-1.5 rounded-md md:rounded-lg"
                      : "p-1.5 sm:p-2 md:p-2 rounded-md md:rounded-lg"
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 opacity-0 md:group-hover:opacity-100 rounded-2xl overflow-hidden"></div>
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 md:w-4 md:h-4 text-gray-700 md:group-hover:text-green-600 md:group-hover:scale-110 transition-all duration-300 relative z-10 origin-center" />
                  {notifUnreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 md:-top-1 md:-right-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 sm:min-w-[18px] sm:h-[18px] px-1 flex items-center justify-center leading-none shadow-md ring-2 ring-white/95 z-20">
                      {notifUnreadCount > 9 ? "9+" : notifUnreadCount}
                    </span>
                  )}
                </button>
              )}

              {/* User Menu */}
              <div className="hidden md:block">
                {isAuthHydrating ? (
                  <div
                    aria-hidden="true"
                    className={`flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100/80 animate-pulse ${
                      isScrolled ? "px-3 py-1" : "px-4 py-1.5 md:px-4 md:py-1.5"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-gray-300" />
                    <span className="h-3 w-12 rounded bg-gray-300" />
                  </div>
                ) : (
                  <div
                    className={`transition-all duration-200 ease-out ${
                      isAuthResolvedVisible
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 -translate-y-1"
                    }`}
                  >
                    {user ? (
                      <button
                        onClick={() => navigate("/profile")}
                        aria-label="Go to profile"
                        className={`flex items-center justify-center md:hover:bg-green-50/80 rounded-full shadow-sm md:hover:shadow-md group overflow-hidden transition-all duration-300 ${
                          isScrolled ? "p-1" : "p-1.5"
                        }`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 opacity-0 md:group-hover:opacity-100 rounded-full"></div>
                        {resolvedProfileImage ? (
                          <img
                            src={resolvedProfileImage}
                            alt={user?.name || "User profile"}
                            onError={() => setImageLoadFailed(true)}
                            className={`rounded-full object-cover shadow-md relative z-10 ring-2 ring-white ${
                              isScrolled ? "w-7 h-7" : "w-8 h-8"
                            }`}
                          />
                        ) : (
                          <div
                            className={`rounded-full bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 flex items-center justify-center text-white font-bold text-xs shadow-md relative z-10 ring-2 ring-white ${
                              isScrolled ? "w-7 h-7" : "w-8 h-8"
                            }`}
                          >
                            {userInitial}
                          </div>
                        )}
                      </button>
                    ) : (
                      <div className="relative" ref={userMenuRef}>
                        <button
                          onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                          className={`relative md:hover:bg-green-50/80 shadow-sm md:hover:shadow-md group flex-shrink-0 active:scale-95 transition-all duration-300 ${
                            isScrolled
                              ? "p-1 sm:p-1.5 md:p-1.5 rounded-md md:rounded-lg"
                              : "p-1.5 sm:p-2 md:p-2 rounded-md md:rounded-lg"
                          }`}
                          aria-label="User menu"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 opacity-0 md:group-hover:opacity-100 rounded-2xl overflow-hidden"></div>
                          <User className="w-4 h-4 sm:w-5 sm:h-5 md:w-4 md:h-4 text-gray-700 md:group-hover:text-green-600 transition-colors duration-300 relative z-10" />
                        </button>
                        
                        {/* Dropdown Menu */}
                        {isUserMenuOpen && (
                          <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-2xl shadow-green-900/10 border border-gray-100 py-2 z-50 overflow-hidden">
                            <div className="px-3 py-2 border-b border-gray-100">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Account</p>
                            </div>
                            <Link
                              to="/login"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-green-50 active:bg-green-100 transition-colors group"
                            >
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 group-hover:bg-green-100 transition-colors">
                                <User className="w-4 h-4 text-green-600" />
                              </div>
                              <span className="text-sm font-medium">Sign In</span>
                            </Link>
                            <Link
                              to="/register"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-green-50 active:bg-green-100 transition-colors group"
                            >
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                                <UserCircle className="w-4 h-4 text-emerald-600" />
                              </div>
                              <span className="text-sm font-medium">Create Account</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open menu"
                className={`md:hidden active:bg-gray-100 rounded-lg md:rounded-xl flex-shrink-0 ${
                  isScrolled ? "p-1.5 sm:p-2" : "p-2 sm:p-2.5"
                }`}
              >
                <Menu
                  className={`text-gray-700 ${isScrolled ? "w-4 h-4 sm:w-5 sm:h-5" : "w-5 h-5 sm:w-6 sm:h-6"}`}
                />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu — Full-screen overlay, slides in from left */}
      <div
        className={`fixed inset-0 z-[60] md:hidden ${
          isMobileMenuOpen
            ? "opacity-100 visible"
            : "opacity-0 invisible pointer-events-none"
        }`}
      >
        {/* Dark backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Full-screen panel */}
        <div
          className={`absolute inset-0 bg-white flex flex-col ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ touchAction: "pan-y" }}
        >
          {/* Header row: logo + close button */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
            <img
              src="/images/logo.png"
              alt="Naturanza Food"
              className="h-9 w-auto object-contain"
            />
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close menu"
              className="p-3 rounded-full bg-gray-100 active:bg-gray-200 active:scale-95"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto bg-gray-50/40">
            <div className="px-4 py-4 flex flex-col">
              {/* ── Auth section ── */}
              {isAuthHydrating ? (
                <div className="bg-white rounded-2xl p-4 mb-6 border border-gray-100 shadow-sm animate-pulse">
                  <div className="h-10 rounded-xl bg-gray-200 mb-2.5" />
                  <div className="h-10 rounded-xl bg-gray-100" />
                </div>
              ) : (
                <div
                  className={`transition-all duration-200 ease-out ${
                    isAuthResolvedVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 -translate-y-1"
                  }`}
                >
                  {user ? (
                    <div className="bg-white rounded-2xl p-4 mb-5 border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-3 mb-3">
                        {resolvedProfileImage ? (
                          <img
                            src={resolvedProfileImage}
                            alt="User profile"
                            onError={() => setImageLoadFailed(true)}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0 ring-2 ring-white shadow-md"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ring-2 ring-white shadow-md">
                            {userInitial}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {user.name || "My Account"}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      <div className="h-px bg-gray-100 mb-2" />
                      <Link
                        to="/profile"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 py-2.5 px-2 rounded-xl text-gray-700 active:bg-emerald-50"
                      >
                        <UserCircle className="w-[18px] h-[18px] text-emerald-500 flex-shrink-0" />
                        <span className="text-sm font-medium flex-1">
                          My Profile
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400 opacity-50" />
                      </Link>
                      <Link
                        to="/orders"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 py-2.5 px-2 rounded-xl text-gray-700 active:bg-emerald-50"
                      >
                        <ShoppingCart className="w-[18px] h-[18px] text-emerald-500 flex-shrink-0" />
                        <span className="text-sm font-medium flex-1">
                          My Orders
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400 opacity-50" />
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 mb-6">
                      <Link
                        to="/login"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-[#16A34A] to-[#15803D] border border-[#166534] text-white rounded-2xl active:scale-95 active:from-[#15803D] active:to-[#166534] font-semibold text-sm shadow-md shadow-green-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86EFAC] focus-visible:ring-offset-2"
                      >
                        <User className="w-4.5 h-4.5" />
                        Sign In
                      </Link>
                      <Link
                        to="/register"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center justify-center gap-2 py-3.5 px-4 bg-white border border-gray-200 text-gray-700 rounded-2xl active:bg-gray-50 font-semibold text-sm shadow-sm"
                      >
                        Create Account
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* ── Navigation section ── */}
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 px-1 mb-2">
                Quick Links
              </p>
              <div className="grid grid-cols-2 gap-1.5 mb-3.5">
                {mobileQuickLinks.map((item) => {
                  const Icon = item.icon;
                  const active = item.path ? isActive(item.path) : false;
                  const theme =
                    quickLinkThemeClasses[item.theme] || quickLinkThemeClasses.shop;

                  const innerContent = (
                    <>
                      <div
                        className={`inline-flex h-7 w-7 xs:h-8 xs:w-8 items-center justify-center rounded-lg ${
                          active ? theme.iconActive : theme.iconIdle
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                      </div>
                      <span
                        className={`mt-1.5 text-[13px] xs:text-sm font-semibold leading-snug ${
                          active ? theme.textActive : "text-[#334155]"
                        }`}
                      >
                        {item.label}
                      </span>
                      <div className="mt-1.5 flex items-center justify-end">
                        {item.badge ? (
                          <span className="inline-flex min-w-[20px] h-5 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-[10px] font-semibold px-1.5">
                            {item.badge}
                          </span>
                        ) : (
                          <ChevronRight
                            className={`h-3.5 w-3.5 xs:h-4 xs:w-4 ${
                              active ? theme.chevronActive : "text-gray-400"
                            }`}
                          />
                        )}
                      </div>
                    </>
                  );

                  if (item.path) {
                    return (
                      <Link
                        key={item.key}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex min-h-[88px] xs:min-h-[96px] flex-col justify-between rounded-xl border px-2.5 py-2 xs:px-3 xs:py-2.5 shadow-sm active:scale-[0.98] transition-all duration-200 ${
                          active ? theme.cardActive : theme.cardIdle
                        }`}
                      >
                        {innerContent}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.onClick}
                      className={`flex min-h-[88px] xs:min-h-[96px] flex-col justify-between rounded-xl border px-2.5 py-2 xs:px-3 xs:py-2.5 text-left shadow-sm active:scale-[0.98] transition-all duration-200 ${theme.cardIdle}`}
                    >
                      {innerContent}
                    </button>
                  );
                })}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">
                  Support
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {mobileSupportLinks.map((item) => {
                    const Icon = item.icon;
                    return (
                    <Link
                      key={item.key}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="inline-flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 px-2.5 py-2 text-xs font-semibold text-gray-700 active:bg-blue-100/60"
                    >
                      <div className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 text-blue-600 mr-1">
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-blue-400" />
                    </Link>
                    );
                  })}
                </div>
              </div>

              {totalItems > 0 && (
                <Link
                  to="/checkout"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mb-4 inline-flex w-full items-center justify-between rounded-2xl border border-green-200 bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 text-white shadow-md"
                >
                  <span className="text-sm font-semibold">Proceed to Checkout</span>
                  <span className="inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-full bg-white/20 px-1.5 text-[11px] font-bold">
                    {totalItems}
                  </span>
                </Link>
              )}

              {/* ── Logout ── */}
              {user && (
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm mb-1">
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3.5 py-3.5 px-4 text-red-500 active:bg-red-50 border-l-[3px] border-transparent"
                  >
                    <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className="flex-1 text-sm font-medium text-left">
                      Logout
                    </span>
                  </button>
                </div>
              )}

              {/* bottom breathing room */}
              <div className="h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsSearchOpen(false)}
          />

          {/* Search Content */}
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 md:p-8">
            {/* Close Button */}
            <button
              onClick={() => setIsSearchOpen(false)}
              className="absolute top-4 right-4 p-2 md:hover:bg-gray-100 rounded-full active:scale-95"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            <h2 className="text-2xl font-bold text-[#2d3a2d] mb-6">
              Search Products
            </h2>

            {/* Search Form */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 md:group-hover:text-green-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for organic products..."
                  className="w-full pl-14 pr-32 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-100 focus:bg-white text-gray-800 placeholder:text-gray-400"
                  autoFocus
                />
                <button
                  type="submit"
                  className="nav-search-modal-submit-btn absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2.5 rounded-xl font-semibold md:hover:from-green-700 md:hover:to-green-800 shadow-md md:hover:shadow-lg active:scale-95 transition-[background-color,box-shadow] duration-200"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Popular Searches */}
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Popular Searches
              </p>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => handlePopularSearch(term)}
                    className="inline-flex items-center gap-1 text-sm bg-gradient-to-br from-gray-50 to-green-50 md:hover:from-green-100 md:hover:to-green-100 text-gray-700 md:hover:text-green-700 px-4 py-2 rounded-full border border-gray-200 md:hover:border-green-300 shadow-sm md:hover:shadow-md font-medium active:scale-95"
                  >
                    <TrendingUp className="w-3 h-3" />
                    {term}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Tips */}
            <div className="mt-6 p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-100">
              <p className="text-xs text-gray-600">
                💡 <span className="font-semibold">Tip:</span> Try searching by
                product name, category, or ingredients for better results!
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
