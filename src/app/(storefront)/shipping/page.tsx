import type { Metadata } from "next";

import { SHIPPING_CONTENT } from "@/components/legal/content/shipping";
import { buildShippingPolicyJsonLd } from "@/components/legal/jsonLd";
import { buildLegalMetadata } from "@/components/legal/pageMetadata";
import { PolicyPage } from "@/components/legal/PolicyPage";
import { JsonLdScript } from "@/components/seo/JsonLdScript";

/**
 * /shipping — static copy, no client JavaScript.
 *
 * The ShippingPolicy structured data now ships in the initial HTML instead of
 * being written into the head by react-helmet after mount. Its amounts come from
 * constants rather than the client settings store; see `@/components/legal/jsonLd`
 * for why, and for the two schema defects preserved from the source.
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
  title: "Shipping and Delivery",
  description:
    "Naturanza Food shipping info. Orders processed within 24 hours. Standard delivery " +
    "2-5 business days in Pakistan. Cash on Delivery available nationwide.",
  keywords: [
    "Naturanza shipping",
    "organic delivery Pakistan",
    "natural products shipping",
    "COD delivery Pakistan",
    "order tracking",
  ],
  path: "/shipping",
});

export default function ShippingPage() {
  return (
    <>
      <JsonLdScript data={buildShippingPolicyJsonLd()} />
      <PolicyPage content={SHIPPING_CONTENT} />
    </>
  );
}
