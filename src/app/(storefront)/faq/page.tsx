import type { Metadata } from "next";

import { FAQ_ENTRIES, FAQ_FOOTNOTE, FAQ_HEADER } from "@/components/legal/content/faq";
import { FaqFootnote, FaqList } from "@/components/legal/FaqList";
import { buildFaqPageJsonLd } from "@/components/legal/jsonLd";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { buildLegalMetadata } from "@/components/legal/pageMetadata";
import { JsonLdScript } from "@/components/seo/JsonLdScript";

/**
 * /faq — a Server Component with no client JavaScript at all.
 *
 * The copy is fixed, the answers are always expanded, and nothing on the page
 * responds to input, so there is no reason for any of it to reach the browser as
 * JavaScript.
 *
 * The SPA emitted this page's FAQPage structured data from a `<Helmet>` inside a
 * lazily-loaded route component, so the schema only existed after React had
 * mounted. It is now in the initial HTML.
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
  title: "Frequently Asked Questions",
  description:
    "Find answers to common questions about Naturanza Food orders, delivery, returns, " +
    "product sourcing, and certifications. Organic products support in Pakistan.",
  keywords: [
    "Naturanza FAQ",
    "organic products questions Pakistan",
    "natural food FAQ",
    "organic store help",
    "honey delivery Pakistan",
  ],
  path: "/faq",
});

export default function FaqPage() {
  return (
    <>
      <JsonLdScript data={buildFaqPageJsonLd(FAQ_ENTRIES)} />
      <LegalPageShell header={FAQ_HEADER}>
        <FaqList entries={FAQ_ENTRIES} />
        <FaqFootnote text={FAQ_FOOTNOTE} />
      </LegalPageShell>
    </>
  );
}
