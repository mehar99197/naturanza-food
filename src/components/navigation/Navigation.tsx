"use client";

/**
 * Site header, ported from frontend/src/components/Navigation.jsx.
 *
 * The 1130-line original is split along the seams its own JSX already had — the
 * bar, the drawer, the search modal — with the effects behind hooks in this
 * folder. Markup and class names are unchanged; what changed is routing:
 *
 *   react-router-dom            ->  next
 *   <Link to>                   ->  next/link <Link href>
 *   useNavigate() / navigate()  ->  useRouter() / router.push()
 *   useLocation().pathname      ->  usePathname()
 *
 * This component stays the single owner of router access so the presentational
 * pieces below it take plain callbacks.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/providers/AuthProvider";
import { useCart } from "@/providers/CartProvider";
import { useWishlist } from "@/providers/WishlistProvider";

import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import { NavActions } from "./NavActions";
import { SearchModal } from "./SearchModal";
import { buildMobileQuickLinks } from "./navLinks";
import { useCartBadgePulse, useWishlistBadgePulse } from "./useBadgePulse";
import { useNavIndicator } from "./useNavIndicator";
import {
  useAuthResolvedVisibility,
  useBodyScrollLock,
  useCloseOnEscape,
  useIsScrolled,
} from "./useNavigationChrome";
import { loginUrlFor } from "@/lib/returnTo";
import { useNotificationCount } from "./useNotificationCount";
import { resolveUserImage, useProfileImage } from "./useProfileImage";
import type { NavigationAuth, NavigationCart, NavigationWishlist } from "./types";

export function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { totalItems, setIsCartOpen }: NavigationCart = useCart();
  const { totalItems: wishlistTotalItems }: NavigationWishlist = useWishlist();
  const { user, loading, logout }: NavigationAuth = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isScrolled = useIsScrolled();
  const isAuthHydrating = loading && !user;
  const isAuthResolvedVisible = useAuthResolvedVisibility(
    isAuthHydrating,
    user?.id,
    user?.email,
  );
  const notifUnreadCount = useNotificationCount(loading, user?.id, pathname);
  const { profileImage, imageLoadFailed, markImageFailed, reset } =
    useProfileImage(user);
  const cartPulse = useCartBadgePulse(totalItems);
  const wishlistPulse = useWishlistBadgePulse(wishlistTotalItems);
  const { navRef, linkRefs, indicator, isReady, setHoveredNavPath } =
    useNavIndicator(pathname);

  useCloseOnEscape(
    isSearchOpen,
    isMobileMenuOpen,
    () => setIsSearchOpen(false),
    () => setIsMobileMenuOpen(false),
  );
  useBodyScrollLock(isMobileMenuOpen);

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

  const handleLogout = () => {
    logout();
    reset();
    router.push("/");
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
      setSearchQuery("");
    }
  };

  const handlePopularSearch = (term: string) => {
    router.push(`/shop?search=${encodeURIComponent(term)}`);
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  const handleWishlistClick = () => {
    if (!user) {
      setIsMobileMenuOpen(false);
      // The source passed `{ state: { from: { pathname } } }` so /login could
      // bounce back here. The App Router has no location state, so the return
      // path travels as a validated query parameter instead — see @/lib/returnTo,
      // which refuses anything that is not a plain same-site path so this cannot
      // become an open redirect. Unlike router state it also survives a refresh.
      router.push(loginUrlFor("/profile/wishlist"));
      return;
    }

    setIsMobileMenuOpen(false);
    router.push("/profile/wishlist");
  };

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
              href="/"
              className="flex items-center group relative flex-shrink-0"
            >
              <div
                className={`flex items-center justify-center ${
                  isScrolled
                    ? "h-8 w-auto sm:h-9 sm:w-auto md:h-9 md:w-auto"
                    : "h-9 w-auto sm:h-10 sm:w-auto md:h-11 md:w-auto"
                } transition-all duration-300 ease-out md:group-`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
            <DesktopNav
              navRef={navRef}
              linkRefs={linkRefs}
              indicator={indicator}
              isNavIndicatorReady={isReady}
              pathname={pathname}
              onHoveredNavPathChange={setHoveredNavPath}
            />

            {/* Actions - Optimized mobile layout */}
            <NavActions
              isScrolled={isScrolled}
              user={user}
              isAuthHydrating={isAuthHydrating}
              isAuthResolvedVisible={isAuthResolvedVisible}
              resolvedProfileImage={resolvedProfileImage}
              userInitial={userInitial}
              cartTotalItems={totalItems}
              cartBadgeLabel={cartBadgeLabel}
              cartPulse={cartPulse}
              wishlistTotalItems={wishlistTotalItems}
              wishlistBadgeLabel={wishlistBadgeLabel}
              wishlistPulse={wishlistPulse}
              notifUnreadCount={notifUnreadCount}
              onOpenSearch={() => setIsSearchOpen(true)}
              onOpenCart={() => setIsCartOpen(true)}
              onWishlistClick={handleWishlistClick}
              onNotificationsClick={() => router.push("/notifications")}
              onProfileClick={() => router.push("/profile")}
              onImageError={markImageFailed}
              onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            />
          </div>
        </div>
      </nav>

      {/* Mobile Menu — Full-screen overlay, slides in from left */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        pathname={pathname}
        quickLinks={buildMobileQuickLinks(Boolean(user))}
        user={user}
        isAuthHydrating={isAuthHydrating}
        isAuthResolvedVisible={isAuthResolvedVisible}
        resolvedProfileImage={resolvedProfileImage}
        userInitial={userInitial}
        cartTotalItems={totalItems}
        onImageError={markImageFailed}
        onLogout={() => {
          handleLogout();
          setIsMobileMenuOpen(false);
        }}
      />

      {/* Search Modal */}
      {isSearchOpen && (
        <SearchModal
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onClose={() => setIsSearchOpen(false)}
          onSubmit={handleSearch}
          onPopularSearch={handlePopularSearch}
        />
      )}
    </>
  );
}
