import type { JsonLd } from "@/server/seo/jsonLd";

/**
 * Emits a JSON-LD block.
 *
 * React escapes the serialised JSON when it sets it through
 * dangerouslySetInnerHTML on a script tag of this type, so a product name
 * containing `</script>` cannot close the block — the stored-XSS route the old
 * string-substitution renderer had to guard against by hand.
 *
 * One document may carry several of these; search engines read them all.
 */
export function JsonLdScript({ data }: { data: JsonLd | JsonLd[] }) {
  const blocks = Array.isArray(data) ? data : [data];

  return (
    <>
      {blocks.map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
