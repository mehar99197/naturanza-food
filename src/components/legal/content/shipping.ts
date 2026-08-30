import { Clock3, PackageCheck, Truck } from "lucide-react";

import { BUSINESS_INFO, SHIPPING_POLICY } from "@/config/legal";

import type { PolicyPageContent } from "../types";

/**
 * /shipping copy, verbatim from `frontend/src/pages/Shipping.jsx`.
 *
 * The delivery windows, dispatch city and free-shipping threshold stay
 * interpolated from `SHIPPING_POLICY` rather than being flattened into the
 * sentences, so changing the policy still changes both this page and anywhere
 * else that quotes it. The contact address reads `BUSINESS_INFO` directly for
 * the reason given in `./faq`.
 */
export const SHIPPING_CONTENT: PolicyPageContent = {
  header: {
    Icon: Truck,
    eyebrow: "Support",
    title: "Shipping Information",
    intro: "Clear and transparent shipping details for a smooth delivery experience.",
  },
  sections: [
    {
      title: "Processing Time",
      content: `Orders are typically processed within 24 hours on business days from our ${SHIPPING_POLICY.dispatchCity} fulfillment center.`,
    },
    {
      title: "Delivery Window",
      content: `Standard delivery usually takes ${SHIPPING_POLICY.standardWindow} after dispatch. Express shipping, where available, takes ${SHIPPING_POLICY.expressWindow}.`,
    },
    {
      title: "Delivery Areas & Charges",
      content: `We deliver across Pakistan. The delivery fee for your city is shown at checkout, and shipping is free on orders above ${SHIPPING_POLICY.freeShippingThreshold}.`,
    },
    {
      title: "Payment Options",
      content:
        "Pay by Cash on Delivery (with a small advance shipping fee) or online via JazzCash, EasyPaisa, or bank transfer. All charges are in Pakistani Rupees (PKR).",
    },
    {
      title: "Tracking Information",
      content: "A tracking update is shared once your order is dispatched.",
    },
  ],
  notes: [
    {
      Icon: Clock3,
      text: `Delivery timelines may vary during holidays, weather disruptions, or high-demand periods. For updates, contact ${BUSINESS_INFO.contacts.shippingEmail}.`,
    },
    {
      Icon: PackageCheck,
      text: "Please inspect your package upon delivery and report any issue within 48 hours.",
    },
  ],
};
