/**
 * Link tables and the mobile quick-link colour themes, lifted verbatim out of
 * Navigation.jsx.
 *
 * They were rebuilt on every render there. Only `mobileQuickLinks` genuinely
 * varies (its fourth entry depends on whether anyone is signed in), so that one
 * stays a function and the rest become module constants. That also makes
 * NAV_LINKS a stable reference, which is what lets the nav-indicator effect
 * depend on it honestly instead of omitting it from the dependency array.
 */

import {
  FileText,
  HelpCircle,
  Home,
  Info,
  MessageCircle,
  Newspaper,
  RotateCcw,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  path: string;
  label: string;
  icon: LucideIcon;
}

/** Which palette a mobile quick-link card is painted in. */
export type QuickLinkTheme = "shop" | "account" | "support";

export interface MobileQuickLink {
  key: string;
  /**
   * Optional because the card renders as a `<button>` when there is nowhere to
   * navigate. No current entry takes that branch, but the markup supports it
   * and is preserved rather than trimmed.
   */
  path?: string;
  label: string;
  icon: LucideIcon;
  theme: QuickLinkTheme;
  /** Replaces the chevron with a count pill when set. */
  badge?: string | number;
  onClick?: () => void;
}

export interface MobileSupportLink {
  key: string;
  path: string;
  label: string;
  icon: LucideIcon;
}

export interface QuickLinkThemeClasses {
  iconActive: string;
  iconIdle: string;
  cardActive: string;
  cardIdle: string;
  textActive: string;
  chevronActive: string;
}

export const NAV_LINKS: readonly NavLink[] = [
  { path: "/", label: "Home", icon: Home },
  { path: "/shop", label: "Shop", icon: ShoppingBag },
  { path: "/about", label: "About", icon: Info },
  { path: "/blog", label: "Blog", icon: Newspaper },
  { path: "/contact", label: "Contact", icon: MessageCircle },
];

/**
 * Signed-out visitors get "Track Order" where signed-in ones get "FAQ" — the
 * one part of the mobile grid that is not static.
 */
export const buildMobileQuickLinks = (
  isSignedIn: boolean,
): MobileQuickLink[] => [
  { key: "home", path: "/", label: "Home", icon: Home, theme: "shop" },
  {
    key: "shop",
    path: "/shop",
    label: "Shop",
    icon: ShoppingBag,
    theme: "shop",
  },
  {
    key: "blog",
    path: "/blog",
    label: "Blog",
    icon: Newspaper,
    theme: "support",
  },
  ...(isSignedIn
    ? [
        {
          key: "faq",
          path: "/faq",
          label: "FAQ",
          icon: HelpCircle,
          theme: "support" as const,
        },
      ]
    : [
        {
          key: "orders",
          path: "/orders",
          label: "Track Order",
          icon: ShoppingCart,
          theme: "account" as const,
        },
      ]),
  {
    key: "contact",
    path: "/contact",
    label: "Contact",
    icon: MessageCircle,
    theme: "support",
  },
];

export const MOBILE_SUPPORT_LINKS: readonly MobileSupportLink[] = [
  { key: "shipping", path: "/shipping", label: "Shipping", icon: Truck },
  { key: "returns", path: "/returns", label: "Returns", icon: RotateCcw },
  { key: "privacy", path: "/privacy", label: "Privacy", icon: Shield },
  { key: "terms", path: "/terms", label: "Terms", icon: FileText },
];

export const QUICK_LINK_THEME_CLASSES: Record<
  QuickLinkTheme,
  QuickLinkThemeClasses
> = {
  shop: {
    iconActive: "bg-green-100 text-green-700",
    iconIdle: "bg-green-50 text-green-600",
    cardActive: "border-green-200 bg-green-50/80",
    cardIdle: "border-green-100/70 bg-white active:bg-green-50/40",
    textActive: "text-green-900",
    chevronActive: "text-green-500",
  },
  account: {
    iconActive: "bg-emerald-100 text-emerald-700",
    iconIdle: "bg-emerald-50 text-emerald-600",
    cardActive: "border-emerald-200 bg-emerald-50/80",
    cardIdle: "border-emerald-100/70 bg-white active:bg-emerald-50/40",
    textActive: "text-emerald-900",
    chevronActive: "text-emerald-500",
  },
  support: {
    iconActive: "bg-blue-100 text-blue-700",
    iconIdle: "bg-blue-50 text-blue-600",
    cardActive: "border-blue-200 bg-blue-50/80",
    cardIdle: "border-blue-100/70 bg-white active:bg-blue-50/40",
    textActive: "text-blue-900",
    chevronActive: "text-blue-500",
  },
};

/** Chips offered inside the search modal when the field is empty. */
export const POPULAR_SEARCHES: readonly string[] = [
  "Honey",
  "Herbal Oil",
  "Green Tea",
  "Turmeric",
  "Organic",
];
