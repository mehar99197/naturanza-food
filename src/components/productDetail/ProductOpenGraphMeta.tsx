/**
 * The four product-specific social tags: `og:type` plus the `product:*` price
 * and availability trio.
 *
 * WHY THESE ARE NOT IN generateMetadata. Next's `Metadata.openGraph` is a union
 * keyed on `type`, and "product" is not one of its members; the escape hatch,
 * `metadata.other`, emits `<meta name="…">` where Open Graph requires
 * `property="…"`. Facebook's scraper reads `property` only, and the SPA emitted
 * `property` through Helmet, so rendering the tags here keeps the markup a
 * scraper sees identical. React hoists `<meta>` rendered anywhere in the tree
 * into `<head>`, so their position in this file does not matter.
 *
 * The rest of the Open Graph block — title, description, image, url, siteName,
 * locale — still comes from generateMetadata, which omits `type` so that
 * nothing here is emitted twice.
 *
 * CURRENCY. The SPA converted this figure into whatever currency it had
 * detected for the visitor and labelled it accordingly. A server-rendered page
 * is cached and shared, so it publishes the canonical PKR price instead — the
 * same number and currency as the JSON-LD offer and as the JSON-LD's
 * `priceCurrency`. Anything else would advertise one visitor's currency to
 * everyone else.
 */
export interface ProductOpenGraphMetaProps {
  /** Post-discount price, formatted to two decimals. */
  price: string;
  currency: string;
  /** "in stock" or "out of stock", the exact strings the SPA published. */
  availability: string;
}

export function ProductOpenGraphMeta({
  price,
  currency,
  availability,
}: ProductOpenGraphMetaProps) {
  return (
    <>
      <meta property="og:type" content="product" />
      {price ? (
        <>
          <meta property="product:price:amount" content={price} />
          <meta property="product:price:currency" content={currency} />
          <meta property="product:availability" content={availability} />
        </>
      ) : null}
    </>
  );
}
