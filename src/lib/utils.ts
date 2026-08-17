/**
 * Money formatting and class-name merging, ported from frontend/src/lib/utils.js.
 *
 * `getProductPricing` is not duplicated here — it lives in @/lib/pricing, which
 * both server and client code share, and is re-exported below so call sites that
 * expect it on `utils` keep working.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { clampPercent, type StoreDiscountSettings } from "@/lib/pricing";
import { convertFromPkr, hasExchangeRate } from "@/lib/exchangeRates";

/**
 * Conditional class names with Tailwind conflict resolution, identical to the
 * Vite app's `cn`.
 *
 * ⚠ `twMerge` does not merely concatenate — it *drops* earlier classes that
 * conflict with later ones (`px-2 px-4` collapses to `px-4`). That is the point
 * when composing variants, but it makes `cn` the wrong tool for a straight port
 * of existing markup: the shared site chrome keeps its original template
 * literals precisely so the emitted class attribute stays byte-identical.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export { clampPercent, getProductPricing } from "@/lib/pricing";
export type { PriceableProduct, ProductPricing, StoreDiscountSettings } from "@/lib/pricing";

/** An amount as it arrives from the API — DECIMAL columns come back as strings. */
export type MoneyInput = number | string | null | undefined;

const currencySymbols: Record<string, string> = {
  USD: "$",
  PKR: "Rs.",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  AED: "د.إ",
  SAR: "﷼",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
  CNY: "¥",
  BDT: "৳",
  MYR: "RM",
  SGD: "S$",
  THB: "฿",
};

const normalizeCurrencyCode = (value: string | null | undefined): string =>
  String(value || "")
    .trim()
    .toUpperCase() || "PKR";

/** Currencies conventionally written without a fractional part. */
const wholeCurrencies = ["PKR", "INR", "JPY", "BDT", "THB"];

/**
 * Prices are grouped with an explicit locale, never the runtime default.
 *
 * A bare `toLocaleString()` reads whatever locale the environment happens to
 * have. Under Vite that was always the browser, so it was merely inconsistent
 * between visitors. Under Next the same string is produced once by Node during
 * SSR and again by the browser during hydration — and when the two locales
 * disagree ("Rs. 1,234" vs "Rs. 1٬234") React discards the server HTML for that
 * subtree. That would fire on essentially every price on the site.
 *
 * en-US matches the grouping the storefront already renders for its English,
 * Pakistan-facing audience.
 */
const PRICE_LOCALE = "en-US";

/**
 * Formats an amount that is *already* in `currency`. No conversion happens
 * here — use `formatPrice` for a PKR amount that needs converting first.
 *
 * Returns "" for null/undefined and for anything that is not a finite number,
 * so a missing price renders as nothing rather than "Rs. NaN".
 */
export function formatCurrency(
  amount: MoneyInput,
  currency: string | null | undefined = "PKR",
): string {
  if (amount === null || amount === undefined) return "";

  const normalizedCurrency = normalizeCurrencyCode(currency);
  const symbol = currencySymbols[normalizedCurrency] || normalizedCurrency;
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return "";

  // Note the asymmetry, preserved from the original: whole-unit currencies get
  // a space after the symbol ("Rs. 1,234") and thousands separators, the rest
  // get neither ("$12.34").
  if (wholeCurrencies.includes(normalizedCurrency)) {
    return `${symbol} ${Math.round(numericAmount).toLocaleString(PRICE_LOCALE)}`;
  }

  return `${symbol}${numericAmount.toFixed(2)}`;
}

/**
 * Formats a PKR amount for display in `currency`, converting on the way.
 *
 * Falls back to formatting the untouched PKR figure *labelled as PKR* when no
 * rate is known, so an unconvertible amount is never mislabelled.
 */
export function formatPrice(
  amount: MoneyInput,
  currency: string | null | undefined = "PKR",
): string {
  if (amount === null || amount === undefined) return "";

  const normalizedCurrency = normalizeCurrencyCode(currency);
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return "";

  if (normalizedCurrency === "PKR") {
    return formatCurrency(numericAmount, normalizedCurrency);
  }

  if (hasExchangeRate(normalizedCurrency)) {
    const convertedAmount = convertFromPkr(numericAmount, normalizedCurrency);
    return formatCurrency(convertedAmount ?? numericAmount, normalizedCurrency);
  }

  return formatCurrency(numericAmount, "PKR");
}

/**
 * A cart line as the API publishes it — snake_case, with numbers that may
 * arrive as DECIMAL strings. Every field is coerced defensively.
 */
export interface StoreSaleCartItem {
  price?: number | string | null;
  discount_percentage?: number | string | null;
  quantity?: number | string | null;
}

/**
 * Total *extra* reduction an active store-wide sale adds on top of the
 * discounts the products already carry, mirroring the backend exactly:
 * `sum(base * qty * max(0, storePct - perProductPct) / 100)`.
 *
 * The `max(0, ...)` is what stops a product whose own discount already beats
 * the sale from being discounted twice. Returns 0 when no sale is active.
 */
export function computeStoreSaleDiscount(
  items: StoreSaleCartItem[] | null | undefined,
  settings?: Partial<StoreDiscountSettings> | null,
): number {
  if (!settings?.storeDiscountActive) return 0;
  const storePct = clampPercent(settings.storeDiscountPercentage);
  if (storePct <= 0 || !Array.isArray(items)) return 0;
  return items.reduce((sum: number, item: StoreSaleCartItem) => {
    const base = Number(item?.price) || 0;
    const perProductPct = clampPercent(item?.discount_percentage);
    const extraPct = Math.max(0, storePct - perProductPct);
    const qty = Number(item?.quantity) || 0;
    return sum + (base * qty * extraPct) / 100;
  }, 0);
}
