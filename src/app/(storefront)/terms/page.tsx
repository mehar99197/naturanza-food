import type { Metadata } from "next";

import { TERMS_CONTENT } from "@/components/legal/content/terms";
import { buildLegalMetadata } from "@/components/legal/pageMetadata";
import { PolicyPage } from "@/components/legal/PolicyPage";

/**
 * /terms — static copy, no client JavaScript.
 *
 * No structured data: `TermsSEO` emitted meta tags only, and neither the source
 * page nor StructuredData.jsx published a schema for this route. None is
 * invented here.
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
  title: "Terms of Service",
  description:
    "Read Naturanza Food's Terms of Service. These terms govern your use of our website " +
    "when purchasing organic and natural products in Pakistan.",
  keywords: ["Naturanza terms of service", "organic store terms Pakistan"],
  path: "/terms",
});

export default function TermsPage() {
  return <PolicyPage content={TERMS_CONTENT} />;
}
