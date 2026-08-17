/**
 * The `md`-and-up footer grid: brand, three link columns, contact cards.
 *
 * No "use client" directive, and deliberately so — this subtree has no state, no
 * effects and no event handlers, only data props. It is currently rendered by
 * Footer.tsx (a Client Component) and so ships in that bundle regardless, but
 * keeping it directive-free means it can also be dropped straight into a Server
 * Component tree later without touching it.
 */

import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import type {
  FooterContactDetails,
  FooterLink,
  FooterLinkGroups,
  SocialLink,
} from "./types";

function LinkColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div className="min-w-0 self-start lg:col-span-2 lg:pt-1">
      <h4 className="font-display font-bold text-base mb-5 text-white">{title}</h4>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.path}
              className="text-white/70 md:hover:text-white text-sm font-medium inline-flex items-center gap-1.5 group transition-all duration-200 md:hover:translate-x-1 break-words"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface FooterColumnsProps {
  footerLinks: FooterLinkGroups;
  socialLinks: SocialLink[];
  contact: FooterContactDetails;
}

export function FooterColumns({
  footerLinks,
  socialLinks,
  contact,
}: FooterColumnsProps) {
  return (
    <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-12 items-start gap-8 md:gap-9 lg:gap-x-8 lg:gap-y-8">
      {/* Brand */}
      <div className="text-center sm:text-left md:col-span-2 lg:col-span-3 min-w-0 self-start">
        <Link href="/" className="flex items-center gap-3 mb-6 md:mb-8 group justify-center sm:justify-start">
          <div className="h-16 w-40 md:h-20 md:w-48 lg:h-20 lg:w-48 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/f_logo.png"
              alt="Naturanza Food"
              className="h-full object-contain brightness-0 invert drop-shadow-2xl md:group-hover:drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]"
            />
          </div>
        </Link>
        <p className="text-white/90 mb-6 md:mb-10 max-w-sm text-xs sm:text-sm leading-relaxed font-medium mx-auto sm:mx-0">
          Pure Nature. Pure Health. Discover our range of premium organic products
          sourced from sustainable farms around the world.
        </p>
        <div className="flex gap-2.5 md:gap-3 justify-center sm:justify-start">
          {socialLinks.map((social) => {
            const Icon = social.icon;
            return (
              <a
                key={`desktop-${social.label}`}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Follow us on ${social.label}`}
                className="w-9 h-9 md:w-10 md:h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg md:rounded-xl flex items-center justify-center group shadow-lg shadow-black/20 active:scale-95 transition-all duration-300 md:hover:-translate-y-1 md:hover:bg-white/20 md:hover:border-emerald-200/70 md:hover:shadow-[0_0_0_1px_rgba(167,243,208,0.35),0_14px_30px_rgba(16,185,129,0.28)]"
              >
                <Icon className="w-4 h-4 md:w-5 md:h-5 text-white transition-all duration-300 md:group-hover:scale-110 md:group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.85)]" />
              </a>
            );
          })}
        </div>
      </div>

      {/* Shop Links */}
      <LinkColumn title="Shop" links={footerLinks.shop} />

      {/* Company Links */}
      <LinkColumn title="Company" links={footerLinks.company} />

      {/* Support Links */}
      <LinkColumn title="Support" links={footerLinks.support} />

      {/* Contact */}
      <div className="min-w-0 self-start md:col-span-2 lg:col-span-3 lg:pr-0 lg:pt-1">
        <h4 className="font-display font-bold text-base mb-5 text-white">Get in Touch</h4>
        <ul className="space-y-3.5 max-w-[340px] ml-0 md:mx-auto lg:mx-0">
          <li className="group">
            <div className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03] md:hover:bg-white/[0.08] transition-colors duration-300 min-w-0 min-h-[74px]">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <span className="text-white/90 text-sm font-medium leading-snug break-words min-w-0">
                {contact.locationLabel}
              </span>
            </div>
          </li>
          <li className="group">
            <a href={`tel:${contact.phoneLink}`} className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03] md:hover:bg-white/[0.08] transition-colors duration-300 min-w-0 min-h-[74px]">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <span className="text-white/90 md:hover:text-white text-sm font-medium leading-snug break-words min-w-0">
                {contact.supportPhone}
              </span>
            </a>
          </li>
          <li className="group">
            <a href={`mailto:${contact.supportEmail}`} className="flex items-center gap-3 p-3 rounded-2xl border border-white/10 bg-white/[0.03] md:hover:bg-white/[0.08] transition-colors duration-300 min-w-0 min-h-[74px]">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <span className="text-white/90 md:hover:text-white text-sm font-medium leading-snug break-all min-w-0">
                {contact.supportEmail}
              </span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
