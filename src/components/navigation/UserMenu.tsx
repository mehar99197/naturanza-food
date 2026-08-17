"use client";

// "use client": owns the signed-out dropdown's open state and a document-level
// click-outside listener.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { User, UserCircle } from "lucide-react";

import type { NavigationUser } from "./types";

export interface UserMenuProps {
  /** Session still resolving — render the pill skeleton instead of guessing. */
  isAuthHydrating: boolean;
  isScrolled: boolean;
  /** Drives the one-frame fade once auth has resolved. */
  isAuthResolvedVisible: boolean;
  user: NavigationUser | null;
  /** Already reconciled with localStorage and the load-failure flag. */
  resolvedProfileImage: string | null;
  /** First letter of the name or email; shown when there is no avatar. */
  userInitial: string;
  onImageError: () => void;
  onProfileClick: () => void;
}

/**
 * The desktop-only account control: a skeleton while auth resolves, then either
 * the avatar button (signed in) or a sign-in/register dropdown (signed out).
 *
 * The open state lives here rather than in Navigation because this component is
 * mounted unconditionally — the three branches are inside it — so hoisting the
 * state up would gain nothing and only widen Navigation's surface.
 */
export function UserMenu({
  isAuthHydrating,
  isScrolled,
  isAuthResolvedVisible,
  user,
  resolvedProfileImage,
  userInitial,
  onImageError,
  onProfileClick,
}: UserMenuProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // Close user menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
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
              onClick={onProfileClick}
              aria-label="Go to profile"
              className={`flex items-center justify-center md:hover:bg-green-50/80 rounded-full shadow-sm md:hover:shadow-md group overflow-hidden transition-all duration-300 ${
                isScrolled ? "p-1" : "p-1.5"
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-400/20 to-emerald-400/20 opacity-0 md:group-hover:opacity-100 rounded-full"></div>
              {resolvedProfileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolvedProfileImage}
                  alt={user?.name || "User profile"}
                  onError={onImageError}
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
                    href="/login"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-green-50 active:bg-green-100 transition-colors group"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 group-hover:bg-green-100 transition-colors">
                      <User className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium">Sign In</span>
                  </Link>
                  <Link
                    href="/register"
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
  );
}
