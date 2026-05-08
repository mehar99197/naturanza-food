import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  BellOff,
  Box,
  Grid3X3,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings,
  Tag,
  ShieldUser,
  ShoppingCart,
  Star,
  Ticket,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAdminNotifications } from "@/context/AdminNotificationsContext";

const MOBILE_MEDIA_QUERY = "(max-width: 1023px)";
const COLLAPSED_MENU_ICON_CLASS = "h-4 w-4";
const EXPANDED_MENU_ICON_CLASS = "h-[18px] w-[18px]";
const SIDEBAR_SCROLL_STORAGE_KEY = "admin-sidebar-scroll-top";
const AdminLayoutContext = createContext(false);
const ADMIN_SECTION_TRANSITION = { duration: 0.2, ease: [0.22, 1, 0.36, 1] };

const navItems = [
  { path: "/admin/dashboard", label: "Dashboard", icon: LayoutGrid },
  { path: "/admin/products", label: "Products", icon: Box },
  { path: "/admin/categories", label: "Categories", icon: Tag },
  { path: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { path: "/admin/customers", label: "Customers", icon: Users },
  { path: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/admin/coupons", label: "Coupons", icon: Ticket },
  { path: "/admin/payments", label: "Payments", icon: Wallet },
  { path: "/admin/messages", label: "Messages", icon: MessageSquare },
  { path: "/admin/notifications", label: "Notifications", icon: Bell },
  { path: "/admin/reviews", label: "Reviews", icon: Star },
  { path: "/admin/shipping", label: "Shipping", icon: Truck },
  { path: "/admin/returns", label: "Returns", icon: RotateCcw },
  { path: "/admin/reports", label: "Reports", icon: Grid3X3 },
  { path: "/admin/settings", label: "Settings", icon: Settings },
  { path: "/admin/admins", label: "Admin", icon: ShieldUser },
];

const getAdminInitials = (admin) => {
  const name = String(admin?.name || "AU").trim();
  if (!name) {
    return "AU";
  }

  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] || "A"}${parts[1][0] || "U"}`.toUpperCase();
};

const isMobileViewport = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
};

export function AdminLayout({ children }) {
  const hasParentLayout = useContext(AdminLayoutContext);

  if (hasParentLayout) {
    return children;
  }

  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}

function AdminLayoutShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { admin, adminLogout } = useAdminAuth();
  const { unreadCount, isMuted } = useAdminNotifications();
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const navScrollRef = useRef(null);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("admin-sidebar-collapsed") === "true";
  });

  const persistSidebarScrollTop = (nextScrollTop) => {
    if (typeof window === "undefined") {
      return;
    }

    const normalized = Number.isFinite(nextScrollTop) ? Math.max(0, Math.floor(nextScrollTop)) : 0;
    window.sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(normalized));
  };

  const activeNavItem = useMemo(() => {
    const sortedItems = [...navItems].sort((a, b) => b.path.length - a.path.length);
    return (
      sortedItems.find((item) =>
        item.path === "/admin/dashboard"
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path),
      ) || sortedItems[0]
    );
  }, [location.pathname]);

  const adminInitials = getAdminInitials(admin);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);

    const handleViewportChange = (event) => {
      setIsMobile(event.matches);
      setMobileSidebarOpen(false);
    };

    setIsMobile(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleViewportChange);

      return () => {
        mediaQuery.removeEventListener("change", handleViewportChange);
      };
    }

    mediaQuery.addListener(handleViewportChange);

    return () => {
      mediaQuery.removeListener(handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile, location.pathname]);

  useEffect(() => {
    if (!isMobile) {
      return undefined;
    }

    document.body.style.overflow = mobileSidebarOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, mobileSidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("admin-sidebar-collapsed", String(desktopSidebarCollapsed));
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const navElement = navScrollRef.current;
    if (!navElement) {
      return;
    }

    const savedScrollTop = Number(window.sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY));
    const restoredScrollTop = Number.isFinite(savedScrollTop) ? Math.max(0, savedScrollTop) : 0;

    const frameId = window.requestAnimationFrame(() => {
      navElement.scrollTop = restoredScrollTop;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (navScrollRef.current) {
        persistSidebarScrollTop(navScrollRef.current.scrollTop);
      }
    };
  }, []);

  const handleLogout = async () => {
    await adminLogout();
    navigate("/admin/login");
  };

  const isSidebarCollapsed = !isMobile && desktopSidebarCollapsed;

  const handleSidebarToggle = () => {
    if (isMobile) {
      setMobileSidebarOpen(false);
      return;
    }

    setDesktopSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-[#f5f8f6] text-[#1f2937]">
      <aside
        className={`fixed inset-y-0 left-0 z-50 h-screen w-[252px] max-w-[86vw] transform border-r border-[#0f172a]/10 bg-[#0f172a] text-[#e2e8f0] shadow-[0_18px_44px_rgba(2,6,23,0.3)] transition-[transform,width] duration-300 ${
          isSidebarCollapsed ? "overflow-visible" : "overflow-hidden"
        } ${
          isSidebarCollapsed ? "lg:w-[76px]" : "lg:w-[252px]"
        } ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_40%)]" />

        <div className={`relative z-10 flex h-full flex-col ${isSidebarCollapsed ? "p-2.5" : "p-3.5"}`}>
          <div className={`relative rounded-2xl border border-white/10 bg-white/5 ${
            isSidebarCollapsed
              ? "z-20 mb-3.5 flex items-center justify-center px-0 py-2"
              : "mb-3.5 px-3 py-3.5"
          }`}>
            <button
              type="button"
              onClick={handleSidebarToggle}
              aria-label={isMobile ? "Close sidebar" : isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-white/20 to-white/5 text-white leading-none shadow-[0_8px_18px_rgba(2,6,23,0.35)] transition-colors duration-200 hover:border-emerald-300/45 hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a] ${
                isSidebarCollapsed ? "relative" : "absolute inset-y-0 right-2 my-auto"
              }`}
            >
              {isMobile ? (
                <X className="h-[18px] w-[18px]" />
              ) : isSidebarCollapsed ? (
                <PanelLeftOpen className="h-[18px] w-[18px]" />
              ) : (
                <PanelLeftClose className="h-[18px] w-[18px]" />
              )}
            </button>

            {!isSidebarCollapsed ? (
              <div className="flex items-center gap-3 pr-10">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-sm font-black text-white shadow-[0_10px_22px_rgba(16,185,129,0.35)]">
                  N
                </div>

                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">Naturanza</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Admin Panel
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <nav
            ref={navScrollRef}
            onScroll={(event) => persistSidebarScrollTop(event.currentTarget.scrollTop)}
            className={`relative z-10 flex-1 overflow-y-auto ${
              isSidebarCollapsed ? "scrollbar-hide overflow-x-visible pr-0" : "scrollbar-hide pr-2"
            }`}
          >
            <div className={isSidebarCollapsed ? "space-y-1 pb-0.5 pt-1" : "space-y-1.5 pb-1 pt-1"}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.path === "/admin/dashboard"
                    ? location.pathname === item.path
                    : location.pathname.startsWith(item.path);

                const activeClasses = isSidebarCollapsed
                  ? "border-emerald-300/55 bg-emerald-500/22 text-[#f5f5ef] shadow-[0_4px_10px_rgba(16,185,129,0.18)]"
                  : "border-emerald-300/55 bg-emerald-500/28 text-[#f5f5ef] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_rgba(16,185,129,0.24)]";

                const inactiveClasses = isSidebarCollapsed
                  ? "border-white/10 bg-white/[0.03] text-[#f5f5ef] hover:border-white/25 hover:bg-white/[0.09] hover:text-[#fbfbf7]"
                  : "border-white/10 bg-white/[0.03] text-[#f5f5ef] hover:border-white/30 hover:bg-white/[0.12] hover:text-[#fbfbf7]";

                const linkClasses = `group relative flex items-center overflow-hidden rounded-xl border py-3 transition-[background-color,border-color,box-shadow,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a] ${
                  isSidebarCollapsed ? "h-10 justify-center px-0 py-0" : "gap-3 px-3.5"
                } ${
                  isActive ? activeClasses : inactiveClasses
                }`;

                const iconClasses = `${isSidebarCollapsed ? COLLAPSED_MENU_ICON_CLASS : EXPANDED_MENU_ICON_CLASS} shrink-0 transition-colors duration-200 ${
                  isActive ? "text-white" : "text-white/85 group-hover:text-white"
                }`;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => {
                      if (navScrollRef.current) {
                        persistSidebarScrollTop(navScrollRef.current.scrollTop);
                      }
                    }}
                    className={linkClasses}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    title={item.label}
                  >
                    {isActive ? (
                      isSidebarCollapsed ? (
                        <span className="absolute bottom-0 left-1/2 h-1.5 w-7 -translate-x-1/2 rounded-t-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.85)]" />
                      ) : (
                        <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.85)]" />
                      )
                    ) : null}
                    <Icon className={iconClasses} />
                    {isSidebarCollapsed ? (
                      <>
                        <span className="sr-only">{item.label}</span>
                        <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg border border-white/15 bg-[#0b162a]/95 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-[0_12px_28px_rgba(2,6,23,0.45)] transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                          {item.label}
                        </span>
                      </>
                    ) : (
                      <span className="truncate text-[13px] font-medium leading-tight tracking-[0.01em] text-[#f5f5ef]">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div
            className={`border-t border-white/10 ${
              isSidebarCollapsed ? "mt-2 pt-2" : "mt-3 space-y-2 pt-3"
            }`}
          >
            {!isSidebarCollapsed ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-200 ring-1 ring-emerald-400/45">
                    {adminInitials}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold leading-tight text-white">
                      {admin?.name || "Admin User"}
                    </p>
                    <p className="truncate text-[11px] text-slate-300">
                      {admin?.email || "admin@naturanza.com"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              className={`group relative inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-colors duration-200 hover:border-emerald-300/35 hover:bg-emerald-500/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a] ${
                isSidebarCollapsed
                  ? "h-10 px-0 py-0 text-white"
                  : "gap-2 px-2.5 py-2.5 text-[13px] font-semibold text-[#e2e8f0]"
              }`}
              title="Logout"
            >
              <LogOut className="h-[17px] w-[17px]" />
              {isSidebarCollapsed ? (
                <>
                  <span className="sr-only">Logout</span>
                  <span className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-lg border border-white/15 bg-[#0b162a]/95 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-[0_12px_28px_rgba(2,6,23,0.45)] transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                    Logout
                  </span>
                </>
              ) : (
                "Logout"
              )}
            </button>
          </div>
        </div>
      </aside>

      <div
        className={`transition-[margin] duration-300 ${
          isSidebarCollapsed ? "lg:ml-[76px]" : "lg:ml-[252px]"
        }`}
      >
        <header className="sticky top-0 z-30 border-b border-[#bbf7d0] bg-white/95 backdrop-blur-md">
          <div className="flex h-[74px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#bbf7d0] bg-white text-[#1f2937] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-[#16a34a]/15 text-sm font-black text-[#15803d] sm:inline-flex">
                N
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#15803d]/70">
                  Naturanza Admin
                </p>
                <p className="truncate text-lg font-bold leading-tight text-[#1f2937] sm:text-xl">
                  {activeNavItem?.label || "Dashboard"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => navigate("/admin/notifications")}
                aria-label="Open notifications"
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#bbf7d0] bg-white text-[#1f2937]/70 shadow-sm transition-colors duration-200 hover:bg-[#f0fdf4] hover:text-[#16a34a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {isMuted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white bg-[#ef4444] px-1 text-[10px] font-bold leading-none text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : isMuted ? (
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-400" />
                ) : null}
              </button>

              <div className="inline-flex items-center gap-2.5 rounded-full border border-[#bbf7d0] bg-white px-2.5 py-1.5 shadow-sm">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#16a34a] text-xs font-bold text-white">
                  {adminInitials}
                </div>
                <p className="hidden max-w-[120px] truncate text-sm font-semibold text-[#1f2937] sm:block">
                  {admin?.name || "Admin User"}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-main-theme min-h-[calc(100vh-74px)] p-4 sm:p-6 lg:p-8">
          <AdminLayoutContext.Provider value={true}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={ADMIN_SECTION_TRANSITION}
                className="will-change-transform"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </AdminLayoutContext.Provider>
        </main>
      </div>

      {mobileSidebarOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}
    </div>
  );
}
