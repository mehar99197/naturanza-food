import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { pageTransition } from "@/lib/animations";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { AuthProvider } from "@/context/AuthContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
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
import ProfileLayout from "@/components/ProfileLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
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
import { AdminLogin } from "@/pages/AdminLogin";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { AdminAnalytics } from "@/pages/AdminAnalytics";
import { AdminProducts } from "@/pages/AdminProducts";
import { AdminOrders } from "@/pages/AdminOrders";
import { AdminCustomers } from "@/pages/AdminCustomers";
import { AdminPayments } from "@/pages/AdminPayments";
import { AdminShipping } from "@/pages/AdminShipping";
import { AdminReviews } from "@/pages/AdminReviews";
import { AdminMessages } from "@/pages/AdminMessages";
import { AdminNotifications } from "@/pages/AdminNotifications";
import { AdminReports } from "@/pages/AdminReports";
import { AdminAdmins } from "@/pages/AdminAdmins";
import { AdminReturns } from "@/pages/AdminReturns";
import { AdminOperations } from "@/pages/AdminOperations";
import { AdminSettings } from "@/pages/AdminSettings";
import AdminCoupons from "@/pages/AdminCoupons";
import AdminCategories from "@/pages/AdminCategories";
import Profile from "@/pages/Profile";
import ProfileWishlist from "@/pages/ProfileWishlist";
import ProfileOrders from "@/pages/ProfileOrders";
import ProfileReviews from "@/pages/ProfileReviews";
import SecuritySettings from "@/pages/SecuritySettings";
import { Orders } from "@/pages/Orders";
import OAuthCallback from "@/pages/OAuthCallback";

function ScrollToTop() {
  const { pathname } = useLocation();
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    // Only scroll to top if the pathname actually changed (not on initial load/reload)
    if (
      prevPathnameRef.current !== pathname &&
      prevPathnameRef.current !== undefined
    ) {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
    prevPathnameRef.current = pathname;
  }, [pathname]);

  return null;
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
      <ScrollToTop />
      {showPublicChrome && <Navigation />}
      {showPublicChrome && <CartDrawer />}
      <WishlistToast />
      <main className={mainWrapperClass}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
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

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={<Navigate to="/admin/login" replace />}
            />
            <Route
              path="/admin/login"
              element={<AdminLogin />}
            />
            <Route
              path="/admin/dashboard"
              element={
                <AdminProtectedRoute>
                  <AdminDashboard />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <AdminProtectedRoute>
                  <AdminAnalytics />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/products"
              element={
                <AdminProtectedRoute>
                  <AdminProducts />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <AdminProtectedRoute>
                  <AdminOrders />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/customers"
              element={
                <AdminProtectedRoute>
                  <AdminCustomers />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/payments"
              element={
                <AdminProtectedRoute>
                  <AdminPayments />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/shipping"
              element={
                <AdminProtectedRoute>
                  <AdminShipping />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/reviews"
              element={
                <AdminProtectedRoute>
                  <AdminReviews />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/messages"
              element={
                <AdminProtectedRoute>
                  <AdminMessages />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <AdminProtectedRoute>
                  <AdminNotifications />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <AdminProtectedRoute>
                  <AdminReports />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/admins"
              element={
                <AdminProtectedRoute>
                  <AdminAdmins />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/returns"
              element={
                <AdminProtectedRoute>
                  <AdminReturns />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/operations"
              element={
                <AdminProtectedRoute>
                  <AdminOperations />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/coupons"
              element={
                <AdminProtectedRoute>
                  <AdminCoupons />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/categories"
              element={
                <AdminProtectedRoute>
                  <AdminCategories />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminProtectedRoute>
                  <AdminSettings />
                </AdminProtectedRoute>
              }
            />
          </Routes>
        </AnimatePresence>
      </main>

      {showFooter && <Footer variant={footerVariant} />}
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
                        <Router>
                          <AppContent />
                        </Router>
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
  );
}

export default App;
