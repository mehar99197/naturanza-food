"use client";

/**
 * The signed-out call to action, ported from the `!isActuallyLoggedIn` branch of
 * `ProductReviews.jsx`.
 *
 * The original took an `onLoginClick` prop that ProductDetail.jsx filled with
 * `navigate('/login', { state: { from: { pathname: '/product/' + id } } })`. The
 * App Router has no equivalent of React Router's location state, so
 * `loginUrlFor` encodes the same destination as `?returnTo=%2Fproduct%2F<id>` —
 * the same substitution ProductCard made, and strictly better in one respect,
 * since router state was lost on refresh and a query parameter is not.
 *
 * It stays a `<button>` driving `router.push` rather than becoming a `<Link>`:
 * the rendered element is part of the port, and swapping it for an anchor would
 * change both the DOM and the focus behaviour.
 *
 * `ProductReviews.jsx` also carried an `isActuallyLoggedIn` alias with a comment
 * explaining that it was `isLoggedIn` unchanged — a leftover from a redundant
 * token check that had already been removed. The alias is dropped; the condition
 * it stood for is `isAuthenticated`.
 */

import { useRouter } from "next/navigation";

import { loginUrlFor } from "@/lib/returnTo";

export function ReviewLoginPrompt({ productId }: { productId: number }) {
  const router = useRouter();

  return (
    <div className="mb-8 rounded-xl border border-green-100 bg-green-50/60 p-6 text-center">
      <p className="mb-4 text-base font-medium text-gray-700">
        Please log in to leave a review
      </p>
      <button
        type="button"
        onClick={() => router.push(loginUrlFor(`/product/${productId}`))}
        className="bg-green-600 text-white rounded-lg px-6 py-2 hover:bg-green-700"
      >
        Log In
      </button>
    </div>
  );
}
