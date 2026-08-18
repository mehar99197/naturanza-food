import type { Metadata } from "next";

import { PRIVACY_CONTENT } from "@/components/legal/content/privacy";
import { buildLegalMetadata } from "@/components/legal/pageMetadata";
import { PolicyPage } from "@/components/legal/PolicyPage";

/**
 * /privacy — static copy, no client JavaScript.
 *
 * No structured data, matching the source. See `../terms/page` for the same note.
 */
/**
 * Rendering mode is inherited from the storefront layout, which forces
 * per-request rendering for every route beneath it. It must not be overridden
 * back to a static value here: the Content-Security-Policy admits Next's inline
 * hydration scripts by a per-request nonce, and HTML generated once at build
 * time would carry a nonce matching no later response, so the browser would
 * block the very scripts that make the page work. See backend/csp.js.
 *
 * This page reads no per-request data, so the cost is a render, not a query.
 */

export const metadata: Metadata = buildLegalMetadata({
  title: "Privacy Policy",
  description:
    "Naturanza Food Privacy Policy. Learn how we collect, use, and protect your personal " +
    "information when you shop organic products online in Pakistan.",
  keywords: ["Naturanza privacy policy", "organic store data protection Pakistan"],
  path: "/privacy",
});

export default function PrivacyPage() {
  return <PolicyPage content={PRIVACY_CONTENT} />;
}
