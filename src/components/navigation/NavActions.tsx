"use client";

// "use client": a row of buttons, every one of which is a handler.

import { Menu, Search } from "lucide-react";

import {
  CartButton,
  NotificationBell,
  WishlistButton,
  navIconPadding,
} from "./CartButton";
import { UserMenu } from "./UserMenu";
import type { BadgePulseState } from "./useBadgePulse";
import type { NavigationUser } from "./types";

export interface NavActionsProps {
  isScrolled: boolean;
  user: NavigationUser | null;
  isAuthHydrating: boolean;
  isAuthResolvedVisible: boolean;
  resolvedProfileImage: string | null;
  userInitial: string;
  cartTotalItems: number;
  cartBadgeLabel: string;
  cartPulse: BadgePulseState;
  wishlistTotalItems: number;
  wishlistBadgeLabel: string;
  wishlistPulse: BadgePulseState;
  notifUnreadCount: number;
  onOpenSearch: () => void;
  onOpenCart: () => void;
  onWishlistClick: () => void;
  onNotificationsClick: () => void;
  onProfileClick: () => void;
  onImageError: () => void;
  onOpenMobileMenu: () => void;
}

/**
 * The right-hand cluster of the header: search, wishlist, cart, the bell (signed
 * in only), the desktop account control, and the burger.
 *
 * Every handler is injected rather than resolved here, so all routing decisions
 * stay in Navigation and this file is purely the layout of the row.
 */
export function NavActions({
  isScrolled,
  user,
  isAuthHydrating,
  isAuthResolvedVisible,
  resolvedProfileImage,
  userInitial,
  cartTotalItems,
  cartBadgeLabel,
  cartPulse,
  wishlistTotalItems,
  wishlistBadgeLabel,
  wishlistPulse,
  notifUnreadCount,
  onOpenSearch,
  onOpenCart,
  onWishlistClick,
  onNotificationsClick,
  onProfileClick,
  onImageError,
  onOpenMobileMenu,
}: NavActionsProps) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Search Icon */}
      <button
        onClick={onOpenSearch}
        className={`nav-search-trigger-btn relative md:hover:bg-green-50/80 shadow-sm md:hover:shadow-md group flex-shrink-0 active:scale-95 transition-[background-color,box-shadow,transform] duration-300 ${navIconPadding(
          isScrolled,
        )}`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 opacity-0 md:group-hover:opacity-100 rounded-2xl overflow-hidden"></div>
        <Search className="w-4 h-4 sm:w-5 sm:h-5 md:w-4 md:h-4 text-gray-700 md:group-hover:text-green-600 transition-colors duration-300 relative z-10" />
      </button>

      {/* Wishlist Icon */}
      <WishlistButton
        isScrolled={isScrolled}
        onClick={onWishlistClick}
        totalItems={wishlistTotalItems}
        badgeLabel={wishlistBadgeLabel}
        isBadgePulsing={wishlistPulse.isBadgePulsing}
        isIconBumping={wishlistPulse.isIconBumping}
      />

      {/* Cart Icon */}
      <CartButton
        isScrolled={isScrolled}
        onClick={onOpenCart}
        totalItems={cartTotalItems}
        badgeLabel={cartBadgeLabel}
        isBadgePulsing={cartPulse.isBadgePulsing}
        isIconBumping={cartPulse.isIconBumping}
      />

      {/* Notifications Bell (only for logged-in users) */}
      {user && (
        <NotificationBell
          isScrolled={isScrolled}
          onClick={onNotificationsClick}
          unreadCount={notifUnreadCount}
        />
      )}

      {/* User Menu */}
      <UserMenu
        isAuthHydrating={isAuthHydrating}
        isScrolled={isScrolled}
        isAuthResolvedVisible={isAuthResolvedVisible}
        user={user}
        resolvedProfileImage={resolvedProfileImage}
        userInitial={userInitial}
        onImageError={onImageError}
        onProfileClick={onProfileClick}
      />

      {/* Mobile Menu Button */}
      <button
        onClick={onOpenMobileMenu}
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
  );
}
