import type { Metadata } from "next";

import { COOKIES_CONTENT } from "@/components/legal/content/cookies";
import { buildLegalMetadata } from "@/components/legal/pageMetadata";
import { PolicyPage } from "@/components/legal/PolicyPage";

/**
 * /cookies — static copy, no client JavaScript.
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
  title: "Cookie Policy",
  description:
    "Naturanza Food Cookie Policy. Learn how we use cookies and similar technologies to " +
    "improve your shopping experience for organic and natural products.",
  keywords: ["Naturanza cookie policy", "organic website cookies Pakistan"],
  path: "/cookies",
});

export default function CookiesPage() {
  return <PolicyPage content={COOKIES_CONTENT} />;
}
