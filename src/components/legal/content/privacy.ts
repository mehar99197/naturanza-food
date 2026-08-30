import { Database, Eye, Lock } from "lucide-react";

import { BUSINESS_INFO } from "@/config/legal";

import type { PolicyPageContent } from "../types";

/** /privacy copy, verbatim from `frontend/src/pages/Privacy.jsx`. */
export const PRIVACY_CONTENT: PolicyPageContent = {
  header: {
    Icon: Lock,
    eyebrow: "Security",
    title: "Privacy Policy",
    intro:
      "Your privacy matters to us. This policy explains how we handle your personal information.",
    lastUpdated: "Last updated: May 31, 2026",
  },
  sections: [
    {
      title: "Information We Collect",
      content:
        "We collect details you provide during account creation, orders, and contact requests such as name, email, address, and phone number. If you sign in with Google, we receive your basic Google profile (name and email). For Cash on Delivery and online payments, you may upload a payment screenshot for verification.",
    },
    {
      title: "How We Use Data",
      content:
        "Your data is used to process orders, provide customer support, prevent fraud, send service updates, and improve shopping experience.",
    },
    {
      title: "Lawful Basis and Retention",
      content:
        "We process data for order fulfillment, legitimate business operations, and legal compliance. Order records are generally retained for up to 24 months unless extended by legal requirements.",
    },
    {
      title: "Data Security",
      content:
        "We apply technical and organizational safeguards to protect your information against unauthorized access and misuse.",
    },
    {
      title: "Your Rights",
      content:
        "You may request access, correction, or deletion of your personal data by contacting our support team.",
    },
  ],
  notes: [
    {
      Icon: Eye,
      text: `We never sell your personal data. For privacy requests, email ${BUSINESS_INFO.contacts.privacyEmail}.`,
    },
    {
      Icon: Database,
      text: `Local storage may be used for cart, wishlist, and personalization to improve site performance. For account-related concerns, contact ${BUSINESS_INFO.contacts.supportEmail} or ${BUSINESS_INFO.contacts.phone}. Office: ${BUSINESS_INFO.officeAddress}.`,
    },
  ],
};
