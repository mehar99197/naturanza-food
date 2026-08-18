import { BadgeCheck, RefreshCw, ShieldAlert } from "lucide-react";

import { BUSINESS_INFO, RETURNS_POLICY } from "@/config/legal";

import type { PolicyPageContent } from "../types";

/**
 * /returns copy, verbatim from `frontend/src/pages/Returns.jsx`.
 *
 * The three windows stay interpolated from `RETURNS_POLICY`. Note that the page
 * states a 3-day window while the MerchantReturnPolicy structured data this
 * route emits says 7 — a pre-existing contradiction, preserved and reported
 * rather than silently reconciled. See `../jsonLd`.
 */
export const RETURNS_CONTENT: PolicyPageContent = {
  header: {
    Icon: RefreshCw,
    eyebrow: "Support",
    title: "Returns and Refunds",
    intro: "Our return process is designed to be transparent, fair, and easy to follow.",
  },
  sections: [
    {
      title: "Return Window",
      content: `You may request a return within ${RETURNS_POLICY.returnWindow} of receiving your order, for shipping-related issues only.`,
    },
    {
      title: "Eligible Items",
      content:
        "Returns are accepted only for shipping-related problems — orders that arrive damaged, incorrect, or with missing items. The product must be unused and in its original, sealed packaging.",
    },
    {
      title: "Refund Process",
      content: `After a quality check (usually within ${RETURNS_POLICY.inspectionWindow}), approved returns are refunded to the original payment method within ${RETURNS_POLICY.refundWindow}.`,
    },
    {
      title: "Damaged or Incorrect Orders",
      content:
        "If your order arrives damaged or incorrect, contact support immediately with photos for priority resolution.",
    },
  ],
  notes: [
    {
      Icon: ShieldAlert,
      text: "Change-of-mind returns are not accepted. Opened consumables and temperature-sensitive items are non-returnable for hygiene and safety reasons.",
    },
    {
      Icon: BadgeCheck,
      text: `For return assistance, contact ${BUSINESS_INFO.contacts.returnsEmail} with your order ID and issue details.`,
    },
  ],
};
