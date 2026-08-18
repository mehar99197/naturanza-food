/**
 * The "Product Code" line under the stock pill.
 *
 * It prints the retail barcode as plain text — the SPA's product page never
 * rendered the scannable symbol. `@/components/product/ProductBarcode` (the
 * JsBarcode + QR widget) is used by the admin product screen only, and adding
 * it here would be a redesign, not a port.
 *
 * The same barcode is published as a Schema.org GTIN by the page's JSON-LD; see
 * the ownership note in @/server/seo/jsonLd.
 */
export interface ProductMetaProps {
  barcode: string | null;
}

export function ProductMeta({ barcode }: ProductMetaProps) {
  if (!barcode) return null;

  return (
    <p className="mt-2 text-xs font-medium tracking-wide text-gray-400">
      Product Code: {barcode}
    </p>
  );
}
