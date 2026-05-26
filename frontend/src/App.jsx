import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pageTransition } from "@/lib/animations";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { AuthProvider } from "@/context/AuthContext";
import { AdminAuthProvider, useAdminAuth } from "@/context/AdminAuthContext";
import { AdminDataProvider } from "@/context/AdminDataContext";
import { AdminNotificationsProvider } from "@/context/AdminNotificationsContext";
import { ProductProvider } from "@/context/ProductContext";
import { ReviewProvider } from "@/context/ReviewContext";
import { OrderProvider } from "@/context/OrderContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { CartDrawer } from "@/components/CartDrawer";
import { Loader } from "@/components/Loader";
import { WishlistToast } from "@/components/WishlistToast";
import { AdminLayout } from "@/components/AdminLayout";
import AnnouncementBar from "@/components/AnnouncementBar";
import { CursorPollenTrail } from "@/components/CursorPollenTrail";
import WhatsAppButton from "./components/WhatsAppButton";
import ProfileLayout from "@/components/ProfileLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import { AnalyticsTracker } from "./components/Analytics";
import { Home } from "@/pages/Home";
import { Shop } from "@/pages/Shop";
import { About } from "@/pages/About";
import { ProductDetail } from "@/pages/ProductDetail";
import { Contact } from "@/pages/Contact";
import { Checkout } from "@/pages/Checkout";
import { FAQ } from "@/pages/FAQ";
import { Shipping } from "@/pages/Shipping";
import { Returns } from "@/pages/Returns";
import { Terms } from "@/pages/Terms";
import { Privacy } from "@/pages/Privacy";
import { Cookies } from "@/pages/Cookies";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
// --- Lazy-loaded: admin pages, profile sub-pages, blog, 404 ---
// Splits the bulk of route-specific code out of the initial bundle. Each chunk
// loads on demand when its route is visited, dramatically improving LCP/TTI on
// the public-facing pages a first-time visitor actually sees.
const named = (loader, exportName) =>
  lazy(() => loader().then((m) => ({ default: m[exportName] })));

const AdminForgotPassword = lazy(() => import("@/pages/AdminForgotPassword"));
const AdminResetPassword = lazy(() => import("@/pages/AdminResetPassword"));
const AdminLogin = named(() => import("@/pages/AdminLogin"), "AdminLogin");
const AdminStaffLogin = named(() => import("@/pages/AdminStaffLogin"), "AdminStaffLogin");
const AdminDashboard = named(() => import("@/pages/AdminDashboard"), "AdminDashboard");
const AdminAnalytics = named(() => import("@/pages/AdminAnalytics"), "AdminAnalytics");
const AdminProducts = named(() => import("@/pages/AdminProducts"), "AdminProducts");
const AdminOrders = named(() => import("@/pages/AdminOrders"), "AdminOrders");
const AdminCustomers = named(() => import("@/pages/AdminCustomers"), "AdminCustomers");
const AdminPayments = named(() => import("@/pages/AdminPayments"), "AdminPayments");
const AdminShipping = named(() => import("@/pages/AdminShipping"), "AdminShipping");
const AdminShippingCities = named(() => import("@/pages/AdminShippingCities"), "AdminShippingCities");
const AdminReviews = named(() => import("@/pages/AdminReviews"), "AdminReviews");
const AdminMessages = named(() => import("@/pages/AdminMessages"), "AdminMessages");
const AdminSubscribers = named(() => import("@/pages/AdminSubscribers"), "AdminSubscribers");
const AdminNotifications = named(() => import("@/pages/AdminNotifications"), "AdminNotifications");
const AdminReports = named(() => import("@/pages/AdminReports"), "AdminReports");
const AdminAdmins = named(() => import("@/pages/AdminAdmins"), "AdminAdmins");
const AdminReturns = named(() => import("@/pages/AdminReturns"), "AdminReturns");
const AdminOperations = named(() => import("@/pages/AdminOperations"), "AdminOperations");
const AdminSettings = named(() => import("@/pages/AdminSettings"), "AdminSettings");
const AdminCoupons = lazy(() => import("@/pages/AdminCoupons"));
const AdminCategories = lazy(() => import("@/pages/AdminCategories"));
const AdminAnnouncements = lazy(() => import("@/pages/AdminAnnouncements"));
const AdminTeam = lazy(() => import("@/pages/AdminTeam"));
const Profile = lazy(() => import("@/pages/Profile"));
const ProfileWishlist = lazy(() => import("@/pages/ProfileWishlist"));
const ProfileOrders = lazy(() => import("@/pages/ProfileOrders"));
const ProfileReviews = lazy(() => import("@/pages/ProfileReviews"));
const SecuritySettings = lazy(() => import("@/pages/SecuritySettings"));
const Orders = named(() => import("@/pages/Orders"), "Orders");
const Notifications = named(() => import("@/pages/Notifications"), "Notifications");
const OAuthCallback = lazy(() => import("@/pages/OAuthCallback"));
const NotFound = named(() => import("@/pages/NotFound"), "NotFound");
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));

function ScrollToTop() {
  const { pathname } = useLocation();
  const prevPathnameRef = useRef(pathname);
  const isAdminPath = pathname.startsWith("/admin");

  useEffect(() => {
    // Skip forced window scroll for admin route switches; admin pages manage their own layout scroll.
    if (
      !isAdminPath &&
      prevPathnameRef.current !== pathname &&
      prevPathnameRef.current !== undefined
    ) {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
    prevPathnameRef.current = pathname;
  }, [isAdminPath, pathname]);

  return null;
}

function ReloadScrollRestoration() {
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof performance === "undefined") {
      return;
    }

    const [navEntry] = performance.getEntriesByType("navigation");
    if (navEntry?.type !== "reload") {
      return;
    }

    const key = `scroll:reload:${window.location.pathname}`;
    const stored = window.sessionStorage.getItem(key);
    const y = Number(stored);
    if (Number.isFinite(y)) {
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saveScrollPosition = () => {
      const key = `scroll:reload:${pathnameRef.current}`;
      window.sessionStorage.setItem(key, String(window.scrollY || 0));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveScrollPosition();
      }
    };

    window.addEventListener("beforeunload", saveScrollPosition);
    window.addEventListener("pagehide", saveScrollPosition);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", saveScrollPosition);
      window.removeEventListener("pagehide", saveScrollPosition);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}

function RequireSuperAdmin({ children }) {
  const { admin } = useAdminAuth();
  const location = useLocation();

  if (!admin || admin.admin_role !== 'super_admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}

function RequirePermission({ feature, children }) {
  const { canAccess } = useAdminAuth();

  if (!canAccess(feature)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}

function AdminRouteShell() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const authRoutesWithoutChrome = [
    "/login",
    "/register",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ];
  const isAuthFocusRoute = authRoutesWithoutChrome.includes(location.pathname);
  const isCheckoutRoute = location.pathname === "/checkout";

  // Routes where footer should NOT be shown at all
  const noFooterRoutes = ["/orders"];
  const shouldHideFooter =
    location.pathname.startsWith("/profile") ||
    noFooterRoutes.includes(location.pathname);

  // Determine footer visibility and variant
  const showPublicChrome = !isAdminRoute && !isAuthFocusRoute;
  const showFooter = showPublicChrome && !isCheckoutRoute && !shouldHideFooter;

  // Full footer only on home page, slim footer on other pages
  const isHomePage = location.pathname === "/";
  const footerVariant = isHomePage ? "full" : "slim";

  const mainWrapperClass = "w-full flex-1";

  return (
    <div className="min-h-screen flex flex-col site-glass-shell">
      {/* Skip to main content link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-green-600 focus:text-white focus:rounded-lg focus:font-semibold focus:text-sm"
      >
        Skip to main content
      </a>
<ScrollToTop />
<ReloadScrollRestoration />
      <AnalyticsTracker />
      <CursorPollenTrail />
      {showPublicChrome && <AnnouncementBar />}
      {showPublicChrome && <Navigation />}
      {showPublicChrome && <CartDrawer />}
      <WishlistToast />
      <main id="main-content" className={mainWrapperClass}>
        <AnimatePresence mode={isAdminRoute ? "sync" : "wait"} initial={false}>
          <Suspense fallback={<Loader />}>
          <Routes location={location} key={isAdminRoute ? "/admin" : location.pathname}>
            {/* Public Routes */}
            <Route
              path="/"
              element={
                <motion.div {...pageTransition}>
                  <Home />
                </motion.div>
              }
            />
            <Route
              path="/shop"
              element={
                <motion.div {...pageTransition}>
                  <Shop />
                </motion.div>
              }
            />
            <Route
              path="/about"
              element={
                <motion.div {...pageTransition}>
                  <About />
                </motion.div>
              }
            />
            <Route
              path="/product/:id"
              element={
                <motion.div {...pageTransition}>
                  <ProductDetail />
                </motion.div>
              }
            />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/shipping" element={<Shipping />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/checkout" element={<Checkout />} />
            {/* User Authentication Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/signup" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />

            {/* Protected User Routes */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfileLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Profile />} />
              <Route path="wishlist" element={<ProfileWishlist />} />
              <Route path="orders" element={<ProfileOrders />} />
              <Route path="reviews" element={<ProfileReviews />} />
              <Route path="security" element={<SecuritySettings />} />
            </Route>
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin/login"
              element={<AdminLogin />}
            />
            <Route
              path="/admin/staff-login"
              element={<AdminStaffLogin />}
            />
            <Route
              path="/admin/forgot-password"
              element={<AdminForgotPassword />}
            />
            <Route
              path="/admin/reset-password"
              element={<AdminResetPassword />}
            />
            <Route
              path="/admin"
              element={
                <AdminProtectedRoute>
                  <AdminRouteShell />
                </AdminProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="notifications" element={<AdminNotifications />} />
              <Route path="analytics" element={<RequirePermission feature="analytics"><AdminAnalytics /></RequirePermission>} />
              <Route path="products" element={<RequirePermission feature="products"><AdminProducts /></RequirePermission>} />
              <Route path="orders" element={<RequirePermission feature="orders"><AdminOrders /></RequirePermission>} />
              <Route path="customers" element={<RequirePermission feature="customers"><AdminCustomers /></RequirePermission>} />
              <Route path="payments" element={<RequirePermission feature="payments"><AdminPayments /></RequirePermission>} />
              <Route path="shipping" element={<RequirePermission feature="shipping"><AdminShipping /></RequirePermission>} />
              <Route path="shipping-cities" element={<RequirePermission feature="shipping-cities"><AdminShippingCities /></RequirePermission>} />
              <Route path="reviews" element={<RequirePermission feature="reviews"><AdminReviews /></RequirePermission>} />
              <Route path="messages" element={<RequirePermission feature="messages"><AdminMessages /></RequirePermission>} />
              <Route path="subscribers" element={<RequirePermission feature="subscribers"><AdminSubscribers /></RequirePermission>} />
              <Route path="reports" element={<RequirePermission feature="reports"><AdminReports /></RequirePermission>} />
              <Route path="admins" element={<RequireSuperAdmin><AdminAdmins /></RequireSuperAdmin>} />
              <Route path="returns" element={<RequirePermission feature="returns"><AdminReturns /></RequirePermission>} />
              <Route path="operations" element={<RequireSuperAdmin><AdminOperations /></RequireSuperAdmin>} />
              <Route path="coupons" element={<RequirePermission feature="coupons"><AdminCoupons /></RequirePermission>} />
              <Route path="announcements" element={<RequirePermission feature="announcements"><AdminAnnouncements /></RequirePermission>} />
              <Route path="team" element={<RequirePermission feature="team"><AdminTeam /></RequirePermission>} />
              <Route path="categories" element={<RequirePermission feature="categories"><AdminCategories /></RequirePermission>} />
              <Route path="settings" element={<RequireSuperAdmin><AdminSettings /></RequireSuperAdmin>} />
            </Route>

            {/* 404 Catch-All Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AnimatePresence>
      </main>

      {showFooter && <Footer variant={footerVariant} />}
      {!isAdminRoute && <WhatsAppButton />}
    </div>
  );
}

function App() {
  // Keep splash loader only for home entry, not for auth/admin routes.
  const initialPath =
    typeof window !== "undefined" ? window.location.pathname : "/";
  const shouldShowStartupLoader = initialPath === "/";
  const hasVisited =
    typeof window !== "undefined" && shouldShowStartupLoader
      ? window.sessionStorage.getItem("hasVisitedHome")
      : "true";
  const [loading, setLoading] = useState(shouldShowStartupLoader && !hasVisited);
  const [isFirstVisit] = useState(shouldShowStartupLoader && !hasVisited);
  const [savedScrollPosition] = useState(0);

  useEffect(() => {
    if (isFirstVisit) {
      // Minimum display time for loader
      const minDisplayTime = 1500; // 1.5 seconds
      const startTime = performance.now();

      // Wait for page to be fully loaded
      const checkLoaded = () => {
        if (document.readyState === "complete") {
          const loadTime = performance.now() - startTime;
          // Ensure loader shows for at least minDisplayTime
          const remainingTime = Math.max(0, minDisplayTime - loadTime);

          setTimeout(() => {
            setLoading(false);
            sessionStorage.setItem("hasVisitedHome", "true");

            // Restore scroll position after loader hides
            setTimeout(() => {
              window.scrollTo(0, savedScrollPosition);
            }, 50);
          }, remainingTime);
        } else {
          setTimeout(checkLoaded, 50);
        }
      };

      checkLoaded();
    }
  }, [isFirstVisit, savedScrollPosition]);

  // Show loader immediately on first visit
  if (isFirstVisit && loading) {
    return <Loader fullScreen={true} />;
  }

  return (
    <Router>
      <AuthProvider>
        <AdminAuthProvider>
          <AdminNotificationsProvider>
            <ProductProvider>
              <ReviewProvider>
                <OrderProvider>
                  <AdminDataProvider>
                    <SettingsProvider>
                      <CartProvider>
                        <WishlistProvider>
                          <AppContent />
                        </WishlistProvider>
                      </CartProvider>
                    </SettingsProvider>
                  </AdminDataProvider>
                </OrderProvider>
              </ReviewProvider>
            </ProductProvider>
          </AdminNotificationsProvider>
        </AdminAuthProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
