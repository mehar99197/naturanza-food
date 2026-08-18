"use client";

import { useEffect } from "react";

import { safeLocalStorage } from "@/lib/storage";

/**
 * Deletes two localStorage keys the product page used to write.
 *
 * Reviews once lived in the browser under `productReviews` / `product_reviews`,
 * seeded with placeholder entries. They come from the database now, and the SPA
 * added this cleanup so a returning visitor's stale copies were cleared. Ported
 * because a browser that visited before the change still holds them and nothing
 * else removes them.
 *
 * Renders nothing and has no props; it is a client component purely because
 * localStorage does not exist during server rendering.
 */
export function LegacyReviewStorageCleanup() {
  useEffect(() => {
    safeLocalStorage.removeItem("productReviews");
    safeLocalStorage.removeItem("product_reviews");
  }, []);

  return null;
}
