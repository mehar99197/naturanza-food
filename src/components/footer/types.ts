/**
 * Shapes shared by the footer's pieces.
 *
 * As with the header, the settings slice is declared locally and narrowly: it
 * names exactly the eight fields the footer reads, so a rename in the settings
 * payload surfaces here as a type error rather than as a blank contact block.
 */

import type { LucideIcon } from "lucide-react";

/** A rendered footer link. `path` is an internal route, never an absolute URL. */
export interface FooterLink {
  label: string;
  path: string;
}

/** One social icon, already filtered down to the networks that are configured. */
export interface SocialLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** The store settings the footer reads. Every one may be blank. */
export interface FooterSettings {
  storeEmail?: string | null;
  storePhone?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  mapLocationLabel?: string | null;
}

/** The three link columns; `shop` is filled from the categories API at runtime. */
export interface FooterLinkGroups {
  shop: FooterLink[];
  company: FooterLink[];
  support: FooterLink[];
}

/** Contact details, pre-resolved against the settings defaults. */
export interface FooterContactDetails {
  supportEmail: string;
  supportPhone: string;
  /** `supportPhone` stripped to digits and `+`, for the tel: href. */
  phoneLink: string;
  locationLabel: string;
}
