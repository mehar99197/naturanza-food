"use client";

// "use client": one open section at a time, toggled by tap.

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Mail, MapPin, Phone } from "lucide-react";

import type {
  FooterContactDetails,
  FooterLink,
  FooterLinkGroups,
  SocialLink,
} from "./types";

/** Which accordion is open; null means all closed. */
type SectionKey = "shop" | "company" | "support" | "contact";

interface AccordionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  /**
   * The panel animates between max-h-0 and a fixed height rather than `auto`,
   * which cannot be transitioned. Each section carries its own ceiling because
   * they hold different numbers of rows.
   */
  openHeightClass: string;
  children: React.ReactNode;
}

function Accordion({
  title,
  isOpen,
  onToggle,
  openHeightClass,
  children,
}: AccordionProps) {
  return (
    <div className="border-t border-white/10">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3.5 text-white font-bold text-sm"
      >
        {title}
        <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? openHeightClass : 'max-h-0'}`}>
        {children}
      </div>
    </div>
  );
}

function LinkList({ links }: { links: FooterLink[] }) {
  return (
    <ul className="space-y-3 pb-4">
      {links.map((link) => (
        <li key={link.label}>
          <Link
            href={link.path}
            className="text-white/70 active:text-white text-sm font-medium inline-block transition-all duration-200 active:translate-x-1"
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export interface FooterMobileAccordionProps {
  footerLinks: FooterLinkGroups;
  socialLinks: SocialLink[];
  contact: FooterContactDetails;
}

/**
 * Everything the full footer shows below `md`: the centred brand block followed
 * by four collapsible sections.
 *
 * This is a separate subtree from the desktop grid rather than a responsive
 * reflow of it — the two arrangements differ too much to share markup, which is
 * how the source had it.
 */
export function FooterMobileAccordion({
  footerLinks,
  socialLinks,
  contact,
}: FooterMobileAccordionProps) {
  const [openSection, setOpenSection] = useState<SectionKey | null>(null);

  const toggleSection = (section: SectionKey) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div className="md:hidden space-y-4 mb-3 sm:mb-4">
      {/* Brand Section - Always Visible */}
      <div className="text-center">
        <Link href="/" className="flex items-center gap-3 mb-4 group justify-center">
          <div className="h-14 w-36 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/f_logo.png"
              alt="Naturanza Food"
              className="h-full object-contain brightness-0 invert drop-shadow-2xl"
            />
          </div>
        </Link>
        <p className="text-white/90 mb-5 max-w-sm text-sm leading-relaxed font-medium mx-auto px-4">
          Pure Nature. Pure Health. Discover our range of premium organic products.
        </p>
        <div className="flex gap-3 justify-center">
          {socialLinks.map((social) => {
            const Icon = social.icon;
            return (
              <a
                key={`mobile-${social.label}`}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Follow us on ${social.label}`}
                className="w-9 h-9 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center shadow-[0_6px_16px_rgba(0,0,0,0.2)] active:bg-white/20 active:scale-95 transition-all duration-300"
              >
                <Icon className="w-4 h-4 text-white" />
              </a>
            );
          })}
        </div>
      </div>

      {/* Shop Accordion */}
      <Accordion
        title="Shop"
        isOpen={openSection === 'shop'}
        onToggle={() => toggleSection('shop')}
        openHeightClass="max-h-64"
      >
        <LinkList links={footerLinks.shop} />
      </Accordion>

      {/* Company Accordion */}
      <Accordion
        title="Company"
        isOpen={openSection === 'company'}
        onToggle={() => toggleSection('company')}
        openHeightClass="max-h-56"
      >
        <LinkList links={footerLinks.company} />
      </Accordion>

      {/* Support Accordion */}
      <Accordion
        title="Support"
        isOpen={openSection === 'support'}
        onToggle={() => toggleSection('support')}
        openHeightClass="max-h-64"
      >
        <LinkList links={footerLinks.support} />
      </Accordion>

      {/* Contact Accordion */}
      <Accordion
        title="Contact"
        isOpen={openSection === 'contact'}
        onToggle={() => toggleSection('contact')}
        openHeightClass="max-h-80"
      >
        <ul className="space-y-4 pb-4">
          <li>
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <span className="text-white/90 text-sm font-medium leading-relaxed break-words min-w-0">
                {contact.locationLabel}
              </span>
            </div>
          </li>
          <li>
            <a href={`tel:${contact.phoneLink}`} className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <span className="text-white/90 active:text-white text-sm font-medium break-words min-w-0">
                {contact.supportPhone}
              </span>
            </a>
          </li>
          <li>
            <a href={`mailto:${contact.supportEmail}`} className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <span className="text-white/90 active:text-white text-sm font-medium break-all min-w-0">
                {contact.supportEmail}
              </span>
            </a>
          </li>
        </ul>
      </Accordion>
    </div>
  );
}
