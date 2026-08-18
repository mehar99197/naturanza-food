import type { Metadata } from "next";

import { RETURNS_CONTENT } from "@/components/legal/content/returns";
import { buildReturnPolicyJsonLd } from "@/components/legal/jsonLd";
import { buildLegalMetadata } from "@/components/legal/pageMetadata";
import { PolicyPage } from "@/components/legal/PolicyPage";
import { JsonLdScript } from "@/components/seo/JsonLdScript";

/**
 * /returns — static copy, no client JavaScript.
 *
 * The MerchantReturnPolicy block contradicts the visible policy (7 days and free
 * returns by mail, against the page's 3-day, shipping-damage-only rule). That is
 * how the SPA published it; it is preserved here and reported rather than
 * quietly rewritten, because what Google is told about a merchant's returns is a
 * business decision.
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
  title: "Returns and Refunds Policy",
  description:
    "Naturanza Food returns policy. Request return within 3 days for eligible shipping " +
    "issues. Refund processed within 5-10 business days after quality check.",
  keywords: [
    "Naturanza returns",
    "organic products refund Pakistan",
    "natural food returns",
    "satisfaction guarantee Pakistan",
  ],
  path: "/returns",
});

export default function ReturnsPage() {
  return (
    <>
      <JsonLdScript data={buildReturnPolicyJsonLd()} />
      <PolicyPage content={RETURNS_CONTENT} />
    </>
  );
}
