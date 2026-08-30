import type { Metadata } from "next";

import { ContactForm } from "@/components/contact/ContactForm";
import { ContactHeader } from "@/components/contact/ContactHeader";
import { ContactInfoPanel } from "@/components/contact/ContactInfoPanel";
import { ContactMap } from "@/components/contact/ContactMap";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { DEFAULT_OG_IMAGE, LOCALE, SITE_NAME, SITE_URL } from "@/config/site";
import { buildBreadcrumbJsonLd } from "@/server/seo/jsonLd";

import { buildLocalBusinessJsonLd } from "./jsonLd";

/**
 * /contact — a Server Component shell around four client leaves.
 *
 * The page frame, the metadata and all three structured-data blocks are
 * rendered on the server. Below it, the form owns submit state, and the info
 * panel and map read the store's address, hours, socials and map centre from
 * SettingsProvider, which is a client store; all four still server-render to
 * HTML, so the address and hours are in the initial response rather than
 * appearing after hydration.
 */

const TITLE = "Contact Us";
const DESCRIPTION =
  "Contact Naturanza Food for orders, support, and bulk inquiries. " +
  "Email: support@naturanzafood.com | Phone: +92 340 9502646. " +
  "Available 24/7 for customer support across Pakistan.";
const CANONICAL_PATH = "/contact";

export function generateMetadata(): Metadata {
  const fullTitle = `${TITLE} | ${SITE_NAME}`;

  return {
    title: TITLE,
    description: DESCRIPTION,
    keywords: [
      "contact Naturanza Food",
      "organic food support Pakistan",
      "natural products inquiry",
      "bulk orders organic Pakistan",
      "customer support",
    ],
    alternates: { canonical: CANONICAL_PATH },
    // openGraph and twitter replace the parent objects wholesale rather than
    // merging field by field, so the image is repeated here or it is lost.
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: LOCALE,
      url: `${SITE_URL}${CANONICAL_PATH}`,
      title: fullTitle,
      description: DESCRIPTION,
      images: [{ url: DEFAULT_OG_IMAGE, alt: fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: DESCRIPTION,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export default function ContactPage() {
  const jsonLd = [
    buildBreadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: TITLE, path: CANONICAL_PATH },
    ]),
    buildLocalBusinessJsonLd(),
  ];

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <div className="pt-20 sm:pt-24 pb-14 sm:pb-16 bg-[#faf8f3] min-h-screen overflow-x-hidden">
        <div className="container-custom">
          {/* Header */}
          <ContactHeader />

          <div className="grid md:grid-cols-3 gap-5 sm:gap-6 lg:gap-7 items-start">
            {/* Contact Info */}
            <ContactInfoPanel />

            {/* Contact Form */}
            <ContactForm />
          </div>

          {/* Map */}
          <ContactMap />
        </div>
      </div>
    </>
  );
}
