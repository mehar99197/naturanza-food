// Hover-prefetch helper for the admin sidebar.
//
// When an admin hovers (or focuses) a nav item, we fire the dynamic import
// for that page's lazy chunk so the JS arrives BEFORE the click. By the time
// the user actually clicks, the chunk is in browser memory and the only
// remaining latency is the page's own API call.
//
// Each entry runs at most once per session — dynamic import caches the
// promise internally, so repeat calls are free.

const ROUTE_IMPORTS = {
  "/admin/dashboard":       () => import("@/pages/AdminDashboard"),
  "/admin/analytics":       () => import("@/pages/AdminAnalytics"),
  "/admin/products":        () => import("@/pages/AdminProducts"),
  "/admin/categories":      () => import("@/pages/AdminCategories"),
  "/admin/orders":          () => import("@/pages/AdminOrders"),
  "/admin/customers":       () => import("@/pages/AdminCustomers"),
  "/admin/payments":        () => import("@/pages/AdminPayments"),
  "/admin/shipping":        () => import("@/pages/AdminShipping"),
  "/admin/shipping-cities": () => import("@/pages/AdminShippingCities"),
  "/admin/reviews":         () => import("@/pages/AdminReviews"),
  "/admin/messages":        () => import("@/pages/AdminMessages"),
  "/admin/notifications":   () => import("@/pages/AdminNotifications"),
  "/admin/reports":         () => import("@/pages/AdminReports"),
  "/admin/admins":          () => import("@/pages/AdminAdmins"),
  "/admin/returns":         () => import("@/pages/AdminReturns"),
  "/admin/operations":      () => import("@/pages/AdminOperations"),
  "/admin/coupons":         () => import("@/pages/AdminCoupons"),
  "/admin/announcements":   () => import("@/pages/AdminAnnouncements"),
  "/admin/team":            () => import("@/pages/AdminTeam"),
  "/admin/settings":        () => import("@/pages/AdminSettings"),
};

const fired = new Set();

export function prefetchAdminRoute(path) {
  const loader = ROUTE_IMPORTS[path];
  if (!loader || fired.has(path)) return;
  fired.add(path);
  // Swallow rejections — a failed prefetch must never affect the real navigation.
  loader().catch(() => fired.delete(path));
}
