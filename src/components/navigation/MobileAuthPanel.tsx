"use client";

// "use client": every link closes the drawer on click, and the avatar reports
// load failures back up.

import Link from "next/link";
import { ChevronRight, ShoppingCart, User, UserCircle } from "lucide-react";

import type { NavigationUser } from "./types";

export interface MobileAuthPanelProps {
  isAuthHydrating: boolean;
  isAuthResolvedVisible: boolean;
  user: NavigationUser | null;
  resolvedProfileImage: string | null;
  userInitial: string;
  onImageError: () => void;
  /** Closes the drawer; every link in here navigates away from it. */
  onNavigate: () => void;
}

/**
 * Top block of the mobile drawer: a skeleton while auth resolves, then either
 * the account card (avatar, name, profile/orders shortcuts) or the sign-in and
 * create-account buttons.
 */
export function MobileAuthPanel({
  isAuthHydrating,
  isAuthResolvedVisible,
  user,
  resolvedProfileImage,
  userInitial,
  onImageError,
  onNavigate,
}: MobileAuthPanelProps) {
  if (isAuthHydrating) {
    return (
      <div className="bg-white rounded-2xl p-4 mb-6 border border-gray-100 shadow-sm animate-pulse">
        <div className="h-10 rounded-xl bg-gray-200 mb-2.5" />
        <div className="h-10 rounded-xl bg-gray-100" />
      </div>
    );
  }

  return (
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedProfileImage}
                alt="User profile"
                onError={onImageError}
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
            href="/profile"
            onClick={onNavigate}
            className="flex items-center gap-3 py-2.5 px-2 rounded-xl text-gray-700 active:bg-emerald-50"
          >
            <UserCircle className="w-[18px] h-[18px] text-emerald-500 flex-shrink-0" />
            <span className="text-sm font-medium flex-1">
              My Profile
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400 opacity-50" />
          </Link>
          <Link
            href="/orders"
            onClick={onNavigate}
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
            href="/login"
            onClick={onNavigate}
            className="flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-[#16A34A] to-[#15803D] border border-[#166534] text-white rounded-2xl active:scale-95 active:from-[#15803D] active:to-[#166534] font-semibold text-sm shadow-md shadow-green-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86EFAC] focus-visible:ring-offset-2"
          >
            <User className="w-4.5 h-4.5" />
            Sign In
          </Link>
          <Link
            href="/register"
            onClick={onNavigate}
            className="flex items-center justify-center gap-2 py-3.5 px-4 bg-white border border-gray-200 text-gray-700 rounded-2xl active:bg-gray-50 font-semibold text-sm shadow-sm"
          >
            Create Account
          </Link>
        </div>
      )}
    </div>
  );
}
