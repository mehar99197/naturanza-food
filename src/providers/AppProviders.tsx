"use client";

/**
 * The storefront's client-side context stack.
 *
 * ORDER IS LOAD-BEARING and is taken from `frontend/src/App.jsx`, which nests
 * ten providers as:
 *
 *   Auth > AdminAuth > AdminNotifications > Product > Review > Order >
 *   AdminData > Settings > Cart > Wishlist
 *
 * Dropping the six that belong to a later phase leaves the four below in their
 * original relative order. Each inner one reads the outer ones:
 *
 *   Auth      — outermost; owns the session every provider under it branches on.
 *   Settings  — currency, discounts and store contact details. Independent of
 *               Auth today (it consumed AdminAuthContext, not this one), but it
 *               sat inside Auth in the source and stays there so the admin
 *               phase can slot AdminAuthProvider between them unchanged.
 *   Cart      — calls `useAuth()`; waits on `loading` before fetching and
 *               empties itself when `isAuthenticated` goes false.
 *   Wishlist  — calls `useAuth()` the same way. Innermost, matching the source.
 *
 * Mount this once, high in `app/layout.tsx`. It is a Client Component, so
 * anything it wraps can still be a Server Component — children are passed
 * through as an already-rendered tree.
 */

import type { ReactNode } from "react";

import { AuthProvider } from "./AuthProvider";
import { CartProvider } from "./CartProvider";
import { SettingsProvider } from "./SettingsProvider";
import { WishlistProvider } from "./WishlistProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SettingsProvider>
        <CartProvider>
          <WishlistProvider>{children}</WishlistProvider>
        </CartProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default AppProviders;
