import { Cookie, Settings, Shield } from "lucide-react";

import { BUSINESS_INFO } from "@/config/legal";

import type { PolicyPageContent } from "../types";

/**
 * /cookies copy, verbatim from `frontend/src/pages/Cookies.jsx`.
 *
 * The intro hardcodes the brand name where the other pages interpolate
 * `BUSINESS_INFO.brandName`. Kept as found — the strings are identical today, so
 * changing it would be a refactor of the source rather than a port of it.
 */
export const COOKIES_CONTENT: PolicyPageContent = {
  header: {
    Icon: Cookie,
    eyebrow: "Preferences",
    title: "Cookie Policy",
    intro:
      "This page explains how cookies and similar technologies are used on Naturanza Food.",
    lastUpdated: "Last updated: March 15, 2026",
  },
  sections: [
    {
      title: "What Are Cookies",
      content:
        "Cookies are small text files stored on your device to improve functionality, remember preferences, and support analytics.",
    },
    {
      title: "How We Use Cookies",
      content:
        "We use cookies for essential site operations, session continuity, cart persistence, performance analytics, and user experience improvements.",
    },
    {
      title: "Managing Cookies",
      content:
        "You can disable cookies via browser settings, though some features may not function correctly.",
    },
    {
      title: "Cookie Consent",
      content: `By continuing to browse ${BUSINESS_INFO.websiteDomain}, you consent to necessary cookies. Optional cookies can be controlled through browser or device settings.`,
    },
  ],
  notes: [
    {
      Icon: Settings,
      text: `Adjust your browser cookie settings at any time to control tracking and stored preferences. For help, email ${BUSINESS_INFO.contacts.supportEmail}.`,
    },
    {
      Icon: Shield,
      text: `Essential cookies are required for core operations such as cart, login state, and secure checkout. For policy requests, contact ${BUSINESS_INFO.contacts.privacyEmail}.`,
    },
  ],
};
