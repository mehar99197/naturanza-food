"use client";

/**
 * Site footer, ported from frontend/src/components/Footer.jsx.
 *
 * Two entirely separate layouts hide behind one component — `variant="slim"` for
 * inner pages and the full footer for the home page — which is why the slim
 * branch returns early rather than sharing a shell.
 *
 * react-router-dom -> next: every `<Link to>` became a next/link `<Link href>`.
 * There is no imperative navigation in the footer, so no useNavigate to replace.
 * Only this file needs "use client" for its own sake (it subscribes to settings
 * and polls categories); the two static layouts below it carry no directive.
 */

import Link from "next/link";
import {
  Facebook,
  Instagram,
  Music2,
  Twitter,
  Youtube,
} from "lucide-react";

import { useSettings } from "@/providers/SettingsProvider";

import { FooterColumns } from "./FooterColumns";
import { FooterMobileAccordion } from "./FooterMobileAccordion";
import { FooterNewsletter } from "./FooterNewsletter";
import { FooterSlim } from "./FooterSlim";
import { useFooterCategories } from "./useFooterCategories";
import type {
  FooterLinkGroups,
  FooterSettings,
  SocialLink,
} from "./types";

/** `tel:` will not dial a number carrying spaces or punctuation. */
const normalizePhoneLink = (value: string | null | undefined): string =>
  String(value || "").replace(/[^\d+]/g, "");

const COMPANY_LINKS = [
  { label: 'About Us', path: '/about' },
  { label: 'Blog', path: '/blog' },
  { label: 'Our Story', path: '/about' },
  { label: 'Contact', path: '/contact' }
];

const SUPPORT_LINKS = [
  { label: 'FAQs', path: '/faq' },
  { label: 'Shipping', path: '/shipping' },
  { label: 'Returns', path: '/returns' }
  // Privacy Policy lives in the bottom legal strip — kept single to avoid duplication
];

export interface FooterProps {
  /** "slim" is the compact inner-page footer; "full" is the home-page one. */
  variant?: 'full' | 'slim';
}

export function Footer({ variant = 'full' }: FooterProps) {
  const { settings }: { settings: FooterSettings } = useSettings();
  const categories = useFooterCategories();

  const supportEmail = settings.storeEmail || 'support@naturanzafood.com';
  const supportPhone = settings.storePhone || '+92340 9502646';
  const phoneLink = normalizePhoneLink(supportPhone);

  // Slim version - compact footer for non-home pages
  const isSlim = variant === 'slim';

  const footerLinks: FooterLinkGroups = {
    shop: categories, // Dynamic categories from database
    company: COMPANY_LINKS,
    support: SUPPORT_LINKS
  };

  // A network with no URL configured is dropped rather than rendered dead.
  const socialLinks: SocialLink[] = [
    { label: 'Facebook', href: settings.facebookUrl, icon: Facebook },
    { label: 'Instagram', href: settings.instagramUrl, icon: Instagram },
    { label: 'TikTok', href: settings.tiktokUrl, icon: Music2 },
    { label: 'Twitter', href: settings.twitterUrl, icon: Twitter },
    { label: 'YouTube', href: settings.youtubeUrl, icon: Youtube }
  ].filter((item): item is SocialLink => Boolean(item.href));

  const locationLabel = settings.mapLocationLabel || 'Pakistan, Lahore';

  const contact = { supportEmail, supportPhone, phoneLink, locationLabel };

  // Slim Footer Version - Minimal design for non-home pages
  if (isSlim) {
    return <FooterSlim socialLinks={socialLinks} />;
  }

  // Full Footer Version - Complete design for home page
  return (
    <footer className="relative overflow-x-hidden bg-gradient-to-br from-green-900 via-green-800 to-emerald-900">
      {/* Modern Grid Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '64px 64px'
        }}></div>
      </div>

      {/* Decorative Elements - Enhanced */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-green-500/20 to-emerald-400/15 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-500/20 to-green-400/15 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-400/10 rounded-full blur-3xl"></div>

      {/* Newsletter Section */}
      <FooterNewsletter />

      {/* Main Footer */}
      <div className="container-custom py-6 sm:py-7 md:py-10 lg:py-12 relative z-10">
        {/* Mobile Accordion Layout */}
        <FooterMobileAccordion
          footerLinks={footerLinks}
          socialLinks={socialLinks}
          contact={contact}
        />

        {/* Desktop Grid Layout */}
        <FooterColumns
          footerLinks={footerLinks}
          socialLinks={socialLinks}
          contact={contact}
        />
      </div>

      {/* Bottom Bar — extra bottom/right padding keeps the legal links clear of the
      floating WhatsApp button (fixed bottom-5 right-5) */}
      <div className="border-t border-white/10 relative z-10">
        <div className="container-custom py-3 md:py-5 pb-20 md:pb-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
            <p className="text-white/80 text-xs md:text-sm font-medium">
              © 2026 Naturanza Food. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-3 md:gap-6 md:pr-16 lg:pr-20">
              <Link href="/terms" className="text-white/80 md:hover:text-white text-xs md:text-sm font-medium md:hover:translate-x-1 inline-block">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-white/80 md:hover:text-white text-xs md:text-sm font-medium md:hover:translate-x-1 inline-block">
                Privacy Policy
              </Link>
              <Link href="/cookies" className="text-white/80 md:hover:text-white text-xs md:text-sm font-medium md:hover:translate-x-1 inline-block">
                Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
