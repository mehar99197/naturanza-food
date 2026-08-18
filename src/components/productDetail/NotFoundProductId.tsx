"use client";

import { usePathname } from "next/navigation";

/**
 * The "Looking for product ID: …" line on the not-found screen.
 *
 * `not-found.tsx` is rendered outside the matched route segment and so cannot
 * read `params` — but the id is still in the URL, and a QR code that resolves
 * to a withdrawn product is exactly when someone needs to see which id failed.
 * Reading it from the pathname keeps the original copy intact.
 */
export function NotFoundProductId() {
  const pathname = usePathname();
  const productId = pathname.split("/").filter(Boolean).pop() ?? "";

  return <p className="text-gray-600 mb-2">Looking for product ID: {productId}</p>;
}
