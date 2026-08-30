"use client";

// "use client": the drawer is driven entirely by open/close handlers.

import Link from "next/link";
import { LogOut, X } from "lucide-react";

import { MobileAuthPanel } from "./MobileAuthPanel";
import { MobileQuickLinks } from "./MobileQuickLinks";
import type { MobileQuickLink } from "./navLinks";
import type { NavigationUser } from "./types";

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
  quickLinks: MobileQuickLink[];
  user: NavigationUser | null;
  isAuthHydrating: boolean;
  isAuthResolvedVisible: boolean;
  resolvedProfileImage: string | null;
  userInitial: string;
  cartTotalItems: number;
  onImageError: () => void;
  /** Logs out *and* closes the drawer — the source did both in one handler. */
  onLogout: () => void;
}

/**
 * Full-screen mobile drawer.
 *
 * It stays mounted and is hidden with opacity/visibility rather than unmounted,
 * which is what lets the panel slide out as well as in — an unmounted element
 * cannot animate its exit. `pointer-events-none` on the closed state stops the
 * invisible overlay from swallowing taps on the page behind it.
 */
export function MobileNav({
  isOpen,
  onClose,
  pathname,
  quickLinks,
  user,
  isAuthHydrating,
  isAuthResolvedVisible,
  resolvedProfileImage,
  userInitial,
  cartTotalItems,
  onImageError,
  onLogout,
}: MobileNavProps) {
  return (
    <div
      className={`fixed inset-0 z-[60] md:hidden ${
        isOpen
          ? "opacity-100 visible"
          : "opacity-0 invisible pointer-events-none"
      }`}
    >
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Full-screen panel */}
      <div
        className={`absolute inset-0 bg-white flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ touchAction: "pan-y" }}
      >
        {/* Header row: logo + close button */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logo.png"
            alt="Naturanza Food"
            className="h-9 w-auto object-contain"
          />
          <button
            onClick={onClose}
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
            <MobileAuthPanel
              isAuthHydrating={isAuthHydrating}
              isAuthResolvedVisible={isAuthResolvedVisible}
              user={user}
              resolvedProfileImage={resolvedProfileImage}
              userInitial={userInitial}
              onImageError={onImageError}
              onNavigate={onClose}
            />

            <MobileQuickLinks
              quickLinks={quickLinks}
              pathname={pathname}
              onNavigate={onClose}
            />

            {cartTotalItems > 0 && (
              <Link
                href="/checkout"
                onClick={onClose}
                className="mb-4 inline-flex w-full items-center justify-between rounded-2xl border border-green-200 bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 text-white shadow-md"
              >
                <span className="text-sm font-semibold">Proceed to Checkout</span>
                <span className="inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-full bg-white/20 px-1.5 text-[11px] font-bold">
                  {cartTotalItems}
                </span>
              </Link>
            )}

            {/* ── Logout ── */}
            {user && (
              <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm mb-1">
                <button
                  onClick={onLogout}
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
  );
}
