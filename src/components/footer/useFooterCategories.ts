"use client";

/**
 * The Shop column, loaded from the categories API.
 *
 * It re-fetches every 30 seconds so a category an admin activates or renames
 * appears in the footer without a deploy or a reload. A failure degrades to an
 * empty column rather than an error state — the footer is chrome, and half a
 * footer is better than none.
 */

import { useEffect, useState } from "react";

import { categoryAPI } from "@/lib/api/categories";

import type { FooterLink } from "./types";

const REFRESH_INTERVAL_MS = 30000;

/** A category row as the API returns it. */
interface CategoryRow {
  name: string;
  slug?: string | null;
  /** MySQL BOOLEAN, which arrives as 0/1 from some endpoints and true/false from others. */
  is_active?: number | boolean | null;
}

/**
 * The endpoint has returned both shapes over its life — a bare array and an
 * envelope — and the source coped with either, so this does too.
 */
type CategoriesResponse = { categories?: CategoryRow[] } | CategoryRow[];

export function useFooterCategories(): FooterLink[] {
  const [categories, setCategories] = useState<FooterLink[]>([]);

  // Fetch active categories from the database
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoryAPI.getAll<CategoriesResponse>({
          category_type: "shop_by_category",
        });
        // Filter only active categories
        const rows: CategoryRow[] = Array.isArray(response)
          ? response
          : response?.categories || [];
        const activeCategories = rows
          .filter((cat) => cat.is_active === 1 || cat.is_active === true)
          .map((cat) => ({
            label: cat.name,
            // Falls back to a slugified name so a category with no slug still
            // links somewhere plausible rather than to /shop/undefined.
            path: `/shop/${cat.slug || cat.name.toLowerCase().replace(/\s+/g, "-")}`,
          }));
        setCategories(activeCategories);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
        // Fallback to empty array if fetch fails
        setCategories([]);
      }
    };

    fetchCategories();

    // Refresh categories every 30 seconds to sync with admin changes
    const intervalId = setInterval(fetchCategories, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, []);

  return categories;
}
