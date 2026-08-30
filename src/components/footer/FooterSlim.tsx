/**
 * The compact footer used on every page except the home page.
 *
 * Static, so no "use client" — it renders links and data props only. Like
 * FooterColumns it currently ships inside Footer.tsx's client bundle, but is
 * written so it does not have to.
 */

import Link from "next/link";

import type { SocialLink } from "./types";

export interface FooterSlimProps {
  socialLinks: SocialLink[];
}

export function FooterSlim({ socialLinks }: FooterSlimProps) {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 border-t border-white/10">
      {/* Subtle Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '64px 64px'
        }}></div>
      </div>

      {/* Minimal Decorative Element */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-green-400/10 rounded-full blur-3xl"></div>

      <div className="container-custom py-8 relative z-10">
        {/* Compact Content */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
          {/* Logo & Tagline */}
          <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
            <Link href="/" className="flex items-center group">
              <div className="h-12 w-32 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/f_logo.png"
                  alt="Naturanza Food"
                  className="h-full object-contain brightness-0 invert drop-shadow-lg md:group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                />
              </div>
            </Link>
            <p className="text-white/80 text-sm font-medium text-center sm:text-left">
              Pure Nature. Pure Health.
            </p>
          </div>

          {/* Quick Links + Social (grouped on the right so the row stays balanced
          even when no social links are configured) */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 md:gap-8">
            <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
              <Link href="/about" className="text-white/70 md:hover:text-white text-sm font-medium transition-colors">
                About
              </Link>
              <Link href="/shop" className="text-white/70 md:hover:text-white text-sm font-medium transition-colors">
                Shop
              </Link>
              <Link href="/blog" className="text-white/70 md:hover:text-white text-sm font-medium transition-colors">
                Blog
              </Link>
              <Link href="/contact" className="text-white/70 md:hover:text-white text-sm font-medium transition-colors">
                Contact
              </Link>
              <Link href="/faq" className="text-white/70 md:hover:text-white text-sm font-medium transition-colors">
                FAQ
              </Link>
            </nav>

            {socialLinks.length > 0 && (
              <div className="flex gap-2.5">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="w-9 h-9 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg flex items-center justify-center md:hover:bg-white/20 transition-all duration-300"
                    >
                      <Icon className="w-4 h-4 text-white" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-6 pt-6 border-t border-white/10 text-center">
          <p className="text-white/70 text-xs md:text-sm font-medium">
            © 2026 Naturanza Food. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
