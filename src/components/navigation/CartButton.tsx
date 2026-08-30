"use client";

// "use client": all three are click handlers with animated badge state.

import { Bell, Heart, ShoppingCart } from "lucide-react";

/**
 * The padding/radius swap every icon button in the header shares as the bar
 * collapses on scroll. Factored out because it appears four times byte for byte;
 * the rest of each class string stays inline so the emitted markup is
 * unmistakably the same as the Vite app's.
 */
export const navIconPadding = (isScrolled: boolean): string =>
  isScrolled
    ? "p-1 sm:p-1.5 md:p-1.5 rounded-md md:rounded-lg"
    : "p-1.5 sm:p-2 md:p-2 rounded-md md:rounded-lg";

interface BadgeIconButtonProps {
  isScrolled: boolean;
  onClick: () => void;
}

export interface CartButtonProps extends BadgeIconButtonProps {
  totalItems: number;
  /** Pre-clamped to "99+"; the raw number would overflow the pill. */
  badgeLabel: string;
  isBadgePulsing: boolean;
  isIconBumping: boolean;
}

export function CartButton({
  isScrolled,
  onClick,
  totalItems,
  badgeLabel,
  isBadgePulsing,
  isIconBumping,
}: CartButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative md:hover:bg-green-50/80 shadow-sm md:hover:shadow-md group flex-shrink-0 active:scale-95 transition-all duration-300 ${navIconPadding(
        isScrolled,
      )}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 opacity-0 md:group-hover:opacity-100 rounded-2xl overflow-hidden"></div>
      <ShoppingCart
        className={`w-4 h-4 sm:w-5 sm:h-5 md:w-4 md:h-4 text-gray-700 md:group-hover:text-green-600 md:group-hover:scale-110 transition-all duration-300 relative z-10 origin-center ${isIconBumping ? "cart-icon-bump" : ""}`}
      />
      {totalItems > 0 && (
        <span
          className={`absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 md:-top-1 md:-right-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 sm:min-w-[18px] sm:h-[18px] px-1 flex items-center justify-center leading-none shadow-md ring-2 ring-white/95 z-20 transition-transform duration-200 md:group-hover:scale-105 origin-center ${isBadgePulsing ? "cart-badge-pulse" : ""}`}
        >
          {badgeLabel}
        </span>
      )}
    </button>
  );
}

export interface WishlistButtonProps extends BadgeIconButtonProps {
  totalItems: number;
  badgeLabel: string;
  isBadgePulsing: boolean;
  isIconBumping: boolean;
}

export function WishlistButton({
  isScrolled,
  onClick,
  totalItems,
  badgeLabel,
  isBadgePulsing,
  isIconBumping,
}: WishlistButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`relative md:hover:bg-green-50/80 shadow-sm md:hover:shadow-md group flex-shrink-0 active:scale-95 transition-all duration-300 ${navIconPadding(
        isScrolled,
      )}`}
      aria-label="Open wishlist"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 opacity-0 md:group-hover:opacity-100 rounded-2xl overflow-hidden"></div>
      <Heart
        className={`w-4 h-4 sm:w-5 sm:h-5 md:w-4 md:h-4 text-gray-700 md:group-hover:text-green-600 md:group-hover:scale-110 transition-all duration-300 relative z-10 origin-center ${
          isIconBumping ? "cart-icon-bump" : ""
        }`}
      />
      {totalItems > 0 && (
        <span
          className={`absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 md:-top-1 md:-right-1 bg-gradient-to-r from-rose-500 to-pink-600 text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 sm:min-w-[18px] sm:h-[18px] px-1 flex items-center justify-center leading-none shadow-md ring-2 ring-white/95 z-20 transition-transform duration-200 md:group-hover:scale-105 origin-center ${
            isBadgePulsing ? "cart-badge-pulse" : ""
          }`}
        >
          {badgeLabel}
        </span>
      )}
    </button>
  );
}

export interface NotificationBellProps extends BadgeIconButtonProps {
  unreadCount: number;
}

/**
 * Rendered only for signed-in users. Note the badge caps at "9+" here rather
 * than the "99+" the cart and wishlist use — that asymmetry is in the source and
 * is kept.
 */
export function NotificationBell({
  isScrolled,
  onClick,
  unreadCount,
}: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Open notifications"
      className={`relative md:hover:bg-green-50/80 shadow-sm md:hover:shadow-md group flex-shrink-0 active:scale-95 transition-all duration-300 ${navIconPadding(
        isScrolled,
      )}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 opacity-0 md:group-hover:opacity-100 rounded-2xl overflow-hidden"></div>
      <Bell className="w-4 h-4 sm:w-5 sm:h-5 md:w-4 md:h-4 text-gray-700 md:group-hover:text-green-600 md:group-hover:scale-110 transition-all duration-300 relative z-10 origin-center" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 md:-top-1 md:-right-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 sm:min-w-[18px] sm:h-[18px] px-1 flex items-center justify-center leading-none shadow-md ring-2 ring-white/95 z-20">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}
