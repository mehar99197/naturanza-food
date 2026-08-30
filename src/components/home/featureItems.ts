import { Award, Leaf, ShieldCheck, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { formatPrice } from "@/lib/utils";

export interface HomeFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

/** Free-shipping threshold used when the setting is missing or unparseable. */
const FALLBACK_SHIPPING_FREE = 2000;

/**
 * Reads the free-shipping threshold out of store settings.
 *
 * ⚠ The 2000 here disagrees with the 5000 in `DEFAULT_SETTINGS` and with the
 * "over Rs. 5,000" in the site-wide meta description, so a store whose
 * `shippingFree` is unset advertises a threshold no other surface uses. Carried
 * over from Features.jsx unchanged — reported, not corrected.
 */
export const readShippingFree = (value: unknown): number =>
  Number.isFinite(Number(value)) ? Number(value) : FALLBACK_SHIPPING_FREE;

/**
 * The four benefit cards. A function rather than a constant because the delivery
 * copy quotes the live free-shipping threshold in the visitor's currency, which
 * only SettingsProvider knows.
 */
export const buildFeatures = (
  shippingFree: number,
  currency: string,
): HomeFeature[] => [
  {
    icon: Leaf,
    title: '100% Organic',
    description: 'All our products are certified organic, sourced from sustainable farms with no harmful chemicals.',
  },
  {
    icon: ShieldCheck,
    title: 'Quality Assured',
    description: 'Every product undergoes rigorous testing to ensure premium quality and purity.',
  },
  {
    icon: Truck,
    title: 'Fast Delivery',
    description: `Free shipping on orders over ${formatPrice(shippingFree, currency)} with quick and reliable delivery to your doorstep across Pakistan.`,
  },
  {
    icon: Award,
    title: 'Award Winning',
    description: 'Recognized for excellence in organic food production and sustainable practices.',
  },
];
