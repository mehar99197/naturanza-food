"use client";

// "use client": the address, phone, hours and social links come from
// SettingsProvider, which polls `/settings` in the browser so an admin's edit
// reaches an open tab. The panel still server-renders — with the same default
// settings the SPA started from — so its content is in the initial HTML.

import {
  Clock,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  Music2,
  Phone,
  Twitter,
  Youtube,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BUSINESS_INFO } from "@/config/legal";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useSettings } from "@/providers/SettingsProvider";

import { normalizePhoneLink } from "./contactDetails";

interface ContactInfoEntry {
  icon: LucideIcon;
  title: string;
  content: string;
  link: string | null;
}

export function ContactInfoPanel() {
  const { settings } = useSettings();
  const { ref: infoRef, isVisible: infoVisible } = useScrollReveal({ threshold: 0.15 });

  const supportEmail = settings.storeEmail || BUSINESS_INFO.contacts.supportEmail;
  const supportPhone = settings.storePhone || BUSINESS_INFO.contacts.phone;
  const phoneLink = normalizePhoneLink(supportPhone);
  const address = settings.address || BUSINESS_INFO.officeAddress;
  const supportHours = settings.supportHours || BUSINESS_INFO.supportHours;

  const socialLinks: { label: string; url: string; Icon: LucideIcon }[] = [
    { label: "Facebook", url: settings.facebookUrl, Icon: Facebook },
    { label: "Instagram", url: settings.instagramUrl, Icon: Instagram },
    { label: "TikTok", url: settings.tiktokUrl, Icon: Music2 },
    { label: "Twitter", url: settings.twitterUrl, Icon: Twitter },
    { label: "YouTube", url: settings.youtubeUrl, Icon: Youtube },
  ].filter((item) => item.url);

  const contactInfo: ContactInfoEntry[] = [
    {
      icon: Mail,
      title: "Email",
      content: supportEmail,
      link: `mailto:${supportEmail}`,
    },
    {
      icon: Phone,
      title: "Phone",
      content: supportPhone,
      link: `tel:${phoneLink}`,
    },
    {
      icon: MapPin,
      title: "Address",
      content: address,
      link: null,
    },
    {
      icon: Clock,
      title: "Hours",
      content: supportHours,
      link: null,
    },
  ];

  return (
    <div
      className={`md:col-span-1 reveal reveal-left ${
        infoVisible ? "active" : ""
      }`}
      ref={infoRef}
    >
      <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl p-5 sm:p-6 border border-gray-100 md:sticky md:top-28">
        <h2 className="font-display text-lg font-bold text-[#2d3a2d] mb-5">
          Contact Information
        </h2>
        <div className="space-y-5">
          {contactInfo.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="w-10 h-10 bg-[#3d7a3d]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <item.icon className="w-4 h-4 text-[#3d7a3d]" />
              </div>
              <div>
                <h3 className="font-medium text-[#2d3a2d] text-sm">
                  {item.title}
                </h3>
                {item.link ? (
                  <a
                    href={item.link}
                    className="text-[#6b7a6b] hover:text-[#3d7a3d] text-sm"
                  >
                    {item.content}
                  </a>
                ) : (
                  <p className="text-[#6b7a6b] text-sm">{item.content}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Social Links */}
        {socialLinks.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-medium text-[#2d3a2d] mb-3 text-sm">
              Follow Us
            </h3>
            <div className="flex gap-2.5">
              {socialLinks.map(({ label, url, Icon }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-[#3d7a3d] hover:text-white transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-[#dbe8db] bg-[#f4faf4] p-4">
          <p className="text-[13px] text-[#2d3a2d] font-semibold mb-1">
            Fast Response
          </p>
          <p className="text-xs text-[#5f705f] leading-relaxed">
            Our support team usually replies within 24 hours on business
            days.
          </p>
        </div>
      </div>
    </div>
  );
}
