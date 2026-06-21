import { clsx } from"clsx"
import { twMerge } from"tailwind-merge"
import { convertFromPkr, hasExchangeRate } from"@/lib/exchangeRates"

export function cn(...inputs) {
 return twMerge(clsx(inputs))
}

// Currency formatting utility
const currencySymbols = {
 'USD': '$',
 'PKR': 'Rs.',
 'EUR': '€',
 'GBP': '£',
 'INR': '₹',
 'AED': 'د.إ',
 'SAR': '﷼',
 'CAD': 'C$',
 'AUD': 'A$',
 'JPY': '¥',
 'CNY': '¥',
 'BDT': '৳',
 'MYR': 'RM',
 'SGD': 'S$',
 'THB': '฿'
};

const normalizeCurrencyCode = (value) =>
 String(value || '').trim().toUpperCase() || 'PKR';

export function formatCurrency(amount, currency = 'PKR') {
 if (amount === null || amount === undefined) return '';

 const normalizedCurrency = normalizeCurrencyCode(currency);
 const symbol = currencySymbols[normalizedCurrency] || normalizedCurrency;
 const numericAmount = Number(amount);
 if (!Number.isFinite(numericAmount)) return '';

  // For these currencies, use whole numbers (no decimals)
  const wholeCurrencies = ['PKR', 'INR', 'JPY', 'BDT', 'THB'];
  if (wholeCurrencies.includes(normalizedCurrency)) {
  return `${symbol} ${Math.round(numericAmount).toLocaleString()}`;
  }

  // For others (USD, EUR, GBP, etc.), use 2 decimal places
  return `${symbol}${numericAmount.toFixed(2)}`;
}

export function formatPrice(amount, currency = 'PKR') {
 if (amount === null || amount === undefined) return '';

 const normalizedCurrency = normalizeCurrencyCode(currency);
 const numericAmount = Number(amount);
 if (!Number.isFinite(numericAmount)) return '';

 if (normalizedCurrency === 'PKR') {
 return formatCurrency(numericAmount, normalizedCurrency);
 }

 if (hasExchangeRate(normalizedCurrency)) {
 const convertedAmount = convertFromPkr(numericAmount, normalizedCurrency);
 return formatCurrency(convertedAmount ?? numericAmount, normalizedCurrency);
 }

 return formatCurrency(numericAmount, 'PKR');
}

const clampPercent = (value) => Math.min(Math.max(Number(value) || 0, 0), 90);

/**
 * Display pricing for a single product. Only an active store-wide sale changes
 * the shown price (per-product discounts keep their current, quiet treatment so
 * the storefront looks unchanged when no sale is running). During a sale the
 * effective discount is the BIGGER of the product's own discount_percentage and
 * the store sale %, so a product already on a deeper discount is never crushed.
 *
 * When no sale is active: salePrice === base (product shows its normal price,
 * onSale false). For cart/checkout MONEY use the item's final_price for the
 * no-sale case and computeStoreSaleDiscount() for the sale reduction.
 *
 * Returns: { base, salePrice, effectivePct, onSale, saved, label }
 */
export function getProductPricing(product, settings) {
  const base = Number(product?.price) || 0;
  const perProductPct = clampPercent(product?.discount_percentage);
  const saleActive = Boolean(settings?.storeDiscountActive);
  const storePct = saleActive ? clampPercent(settings?.storeDiscountPercentage) : 0;
  const effectivePct = storePct > 0 ? Math.max(perProductPct, storePct) : 0;
  const salePrice = effectivePct > 0 ? base - (base * effectivePct) / 100 : base;
  return {
    base,
    salePrice,
    effectivePct: Math.round(effectivePct),
    onSale: effectivePct > 0 && salePrice < base,
    saved: base - salePrice,
    label: settings?.storeDiscountLabel || 'Sale',
  };
}

/**
 * Total extra reduction from an active store-wide sale across cart items,
 * mirroring the backend exactly: sum of base*qty*max(0, storePct - perProductPct)/100.
 * Returns 0 when no sale is active. Cart item shape: { price, discount_percentage, quantity }.
 */
export function computeStoreSaleDiscount(items, settings) {
  if (!settings?.storeDiscountActive) return 0;
  const storePct = clampPercent(settings.storeDiscountPercentage);
  if (storePct <= 0 || !Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const base = Number(item?.price) || 0;
    const perProductPct = clampPercent(item?.discount_percentage);
    const extraPct = Math.max(0, storePct - perProductPct);
    const qty = Number(item?.quantity) || 0;
    return sum + (base * qty * extraPct) / 100;
  }, 0);
}
