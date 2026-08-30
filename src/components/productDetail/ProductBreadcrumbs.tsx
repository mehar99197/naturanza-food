import Link from "next/link";

/**
 * The Home / Shop / product-name trail above the fold.
 *
 * Visual only — the machine-readable BreadcrumbList is emitted as JSON-LD from
 * the page, which is what search engines actually read.
 */
export function ProductBreadcrumbs({ productName }: { productName: string }) {
  return (
    <div className="mb-4 md:mb-7 flex items-center gap-2 text-xs md:text-sm text-[#6b7a6b]">
      <Link href="/" className="hover:text-[#2f7a2f]">
        Home
      </Link>
      <span>/</span>
      <Link href="/shop" className="hover:text-[#2f7a2f]">
        Shop
      </Link>
      <span>/</span>
      <span className="font-semibold text-[#2d3a2d] truncate">{productName}</span>
    </div>
  );
}
