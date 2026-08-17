/**
 * Severity palette for the announcement bar.
 *
 * Split out of AnnouncementBar.tsx purely for size: it is a lookup table, and
 * inlining ninety lines of class strings above the component made the component
 * itself hard to read. The strings are unchanged from the Vite app.
 */

import { AlertCircle, Info, Sparkles, Tag, type LucideIcon } from "lucide-react";

export type AnnouncementType =
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "promotion";

/** One announcement as the API publishes it. */
export interface Announcement {
  id: string | number;
  /**
   * Free text on the wire — the column is a VARCHAR, not an enum — so anything
   * unrecognised falls back to the `info` palette rather than rendering unstyled.
   */
  type?: string | null;
  title?: string | null;
  message?: string | null;
}

/** The class names one severity paints its parts with. */
export interface AnnouncementPresentation {
  shell: string;
  icon: string;
  titlePill: string;
  message: string;
  counter: string;
  dismiss: string;
  Icon: LucideIcon;
}

const typeStyles: Record<AnnouncementType, AnnouncementPresentation> = {
  info: {
    shell:
      "border-emerald-200/70 bg-white/90 text-emerald-900 shadow-[0_8px_18px_rgba(16,185,129,0.12)]",
    icon: "bg-emerald-100 text-emerald-700",
    titlePill: "bg-emerald-100 text-emerald-800",
    message: "text-emerald-900/90",
    counter: "bg-emerald-100/70 text-emerald-800",
    dismiss: "hover:bg-emerald-50/80",
    Icon: Info,
  },
  success: {
    shell:
      "border-emerald-200/70 bg-emerald-50/80 text-emerald-900 shadow-[0_8px_18px_rgba(16,185,129,0.12)]",
    icon: "bg-emerald-200/70 text-emerald-800",
    titlePill: "bg-emerald-200/70 text-emerald-900",
    message: "text-emerald-900/90",
    counter: "bg-emerald-200/70 text-emerald-900",
    dismiss: "hover:bg-emerald-100/70",
    Icon: Tag,
  },
  warning: {
    shell:
      "border-amber-200/70 bg-amber-50/85 text-amber-900 shadow-[0_8px_18px_rgba(217,119,6,0.12)]",
    icon: "bg-amber-100 text-amber-700",
    titlePill: "bg-amber-100 text-amber-900",
    message: "text-amber-900/90",
    counter: "bg-amber-100/80 text-amber-800",
    dismiss: "hover:bg-amber-100/60",
    Icon: AlertCircle,
  },
  danger: {
    shell:
      "border-rose-200/70 bg-rose-50/85 text-rose-900 shadow-[0_8px_18px_rgba(225,29,72,0.12)]",
    icon: "bg-rose-100 text-rose-700",
    titlePill: "bg-rose-100 text-rose-900",
    message: "text-rose-900/90",
    counter: "bg-rose-100/80 text-rose-800",
    dismiss: "hover:bg-rose-100/60",
    Icon: AlertCircle,
  },
  promotion: {
    shell:
      "border-emerald-600/30 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-[0_12px_26px_rgba(16,185,129,0.24)]",
    icon: "bg-white/15 text-amber-200",
    titlePill: "bg-white/15 text-amber-100",
    message: "text-white",
    counter: "bg-white/15 text-white",
    dismiss: "hover:bg-white/10",
    Icon: Sparkles,
  },
};

const isAnnouncementType = (value: unknown): value is AnnouncementType =>
  typeof value === "string" && Object.hasOwn(typeStyles, value);

/** Palette for an announcement's `type`, defaulting to `info`. */
export const resolvePresentation = (
  type: string | null | undefined,
): AnnouncementPresentation =>
  isAnnouncementType(type) ? typeStyles[type] : typeStyles.info;
