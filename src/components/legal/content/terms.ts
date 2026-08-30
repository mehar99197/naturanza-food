import { FileText, Scale } from "lucide-react";

import { BUSINESS_INFO } from "@/config/legal";

import type { PolicyPageContent } from "../types";

/** /terms copy, verbatim from `frontend/src/pages/Terms.jsx`. */
export const TERMS_CONTENT: PolicyPageContent = {
  header: {
    Icon: Scale,
    eyebrow: "Legal",
    title: "Terms of Service",
    intro: "Please read these terms carefully before using our website and services.",
    lastUpdated: "Last updated: May 31, 2026",
  },
  sections: [
    {
      title: "Acceptance of Terms",
      content: `By accessing and using ${BUSINESS_INFO.brandName}, you agree to comply with these Terms of Service and all applicable laws and regulations.`,
    },
    {
      title: "Orders and Payments",
      content:
        "All orders are subject to product availability and payment confirmation. Prices are listed in Pakistani Rupees (PKR). We accept Cash on Delivery (with a small advance shipping fee) and online payment via JazzCash, EasyPaisa, or bank transfer. Prices and promotions may change without prior notice.",
    },
    {
      title: "Product Information",
      content:
        "We aim to provide accurate product details, but slight variations in packaging, color, weight, or description may occur due to supplier and batch updates.",
    },
    {
      title: "Governing Law and Jurisdiction",
      content: `These terms are governed by the ${BUSINESS_INFO.governingLaw}. Any disputes shall be resolved under the competent courts of Lahore, Pakistan.`,
    },
    {
      title: "Limitation of Liability",
      content: `${BUSINESS_INFO.brandName} is not liable for indirect or incidental damages resulting from product use, delays, third-party courier issues, or temporary website interruptions.`,
    },
  ],
  notes: [
    {
      Icon: FileText,
      text: `For legal questions, contact ${BUSINESS_INFO.legalName} at ${BUSINESS_INFO.contacts.legalEmail} or ${BUSINESS_INFO.contacts.phone}. Registered office: ${BUSINESS_INFO.officeAddress}. Continued use of this website indicates acceptance of these terms.`,
    },
  ],
};
