import { HelpCircle } from "lucide-react";

import { BUSINESS_INFO } from "@/config/legal";

import type { FaqEntry, LegalHeader } from "../types";

/**
 * /faq copy, verbatim from `frontend/src/pages/FAQ.jsx`.
 *
 * The support email and phone were read from SettingsContext with
 * `BUSINESS_INFO` as the fallback. This page is static and server-rendered, so
 * it reads `BUSINESS_INFO` directly — the same strings `DEFAULT_SETTINGS` seeds
 * the client store with, which is the identical wording unless an admin has
 * overridden them in the settings table. Same call as
 * `@/server/seo/organization`.
 */

const SUPPORT_EMAIL = BUSINESS_INFO.contacts.supportEmail;
const SUPPORT_PHONE = BUSINESS_INFO.contacts.phone;

export const FAQ_HEADER: LegalHeader = {
  Icon: HelpCircle,
  eyebrow: "Support",
  title: "Frequently Asked Questions",
  intro: "Quick answers to common questions about orders, products, and support.",
};

/**
 * Rendered as a plain question-and-answer list, exactly as the source did —
 * there is no accordion, nothing collapses, and so this page needs no client
 * JavaScript at all. It also feeds the FAQPage structured data, which is why the
 * answers are plain strings rather than markup.
 */
export const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    question: "How long does delivery take?",
    answer:
      "Most orders are delivered within 2 to 5 business days across Pakistan, depending on your city. Delivery is free on orders over Rs. 5,000.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "You can pay by Cash on Delivery (with a small advance shipping fee) or online via JazzCash, EasyPaisa, or bank transfer. All prices are in Pakistani Rupees (PKR).",
  },
  {
    question: "Are your products 100% organic?",
    answer:
      "Yes, we source from trusted farms and prioritize certified organic and natural ingredients.",
  },
  {
    question: "Can I track my order?",
    answer:
      "Yes, you can track your order from your account order section after dispatch.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Returns and refunds are accepted within 3 days of delivery for shipping-related issues only — orders that arrive damaged, incorrect, or with missing items. Share photos with your order ID and we will resolve it quickly.",
  },
  {
    question: "How can I contact support quickly?",
    answer: `You can reach us at ${SUPPORT_EMAIL} or call ${SUPPORT_PHONE} during ${BUSINESS_INFO.supportHours}.`,
  },
  {
    question: "Do you deliver outside Pakistan?",
    answer:
      "At the moment, we primarily serve Pakistan. International shipping availability may vary by product and destination.",
  },
  {
    question: "How do I change or cancel an order?",
    answer:
      "Order changes or cancellations are possible before dispatch. Contact support immediately with your order ID for assistance.",
  },
];

/** The closing green panel. FAQ's has no icon, unlike the policy pages'. */
export const FAQ_FOOTNOTE = `Need more help? Contact our support desk at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE}.`;
