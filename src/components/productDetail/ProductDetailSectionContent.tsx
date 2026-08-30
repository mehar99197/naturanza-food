import { Check, Zap } from "lucide-react";

import type { DetailSectionKey } from "./constants";
import type { ProductDetailContent } from "./productContent";

/**
 * The body of one Description / Ingredients / Benefits / Usage section.
 *
 * A Server Component. The tab strip and the accordion that show and hide these
 * are Client Components, but they receive already-rendered nodes as props — so
 * the copy is server-rendered even though the widget around it is interactive,
 * and none of this markup or its `content` reaches the client bundle.
 *
 * Like the original, only the open section is mounted; the other three are not
 * in the DOM until you click them.
 *
 * The empty-state wording differs per section and is reproduced verbatim; so is
 * the fall-through, where an unrecognised key lands on the generic usage advice
 * rather than rendering nothing.
 */

export interface ProductDetailSectionContentProps {
  sectionKey: DetailSectionKey;
  content: ProductDetailContent;
}

const EmptyNotice = ({ children }: { children: string }) => (
  <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-gray-700">
    {children}
  </div>
);

/** Repeated verbatim under both the populated and the empty usage sections. */
const UsageDisclaimer = () => (
  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800">
    <p>
      Consult your healthcare professional before use if you are pregnant, nursing, or managing
      a medical condition.
    </p>
  </div>
);

export function ProductDetailSectionContent({
  sectionKey,
  content,
}: ProductDetailSectionContentProps) {
  if (sectionKey === "description") {
    if (content.descriptionParagraphs.length === 0) {
      return <EmptyNotice>No description available for this product yet.</EmptyNotice>;
    }

    return (
      <div className="space-y-3 text-sm leading-relaxed text-gray-700">
        {content.descriptionParagraphs.map((paragraph, index) => (
          <p key={`description-${index}`}>{paragraph}</p>
        ))}
      </div>
    );
  }

  if (sectionKey === "ingredients") {
    if (content.ingredients.length === 0) {
      return <EmptyNotice>Ingredients are not provided yet.</EmptyNotice>;
    }

    return (
      <ul className="grid gap-2 sm:grid-cols-2">
        {content.ingredients.map((ingredient, index) => (
          <li
            key={`${ingredient}-${index}`}
            className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
          >
            <span className="inline-flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
              <span>{ingredient}</span>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (sectionKey === "benefits") {
    if (content.benefits.length === 0) {
      return <EmptyNotice>Benefits are not provided yet.</EmptyNotice>;
    }

    return (
      <ul className="grid gap-2 sm:grid-cols-2">
        {content.benefits.map((benefit, index) => (
          <li
            key={`${benefit}-${index}`}
            className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-sm text-gray-700"
          >
            <span className="flex items-start gap-2">
              <Zap className="mt-0.5 h-4 w-4 text-amber-600" />
              <span>{benefit}</span>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (content.usage.length > 0) {
    return (
      <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
        <ol className="space-y-2">
          {content.usage.map((step, index) => (
            <li
              key={`usage-${index}`}
              className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 shadow-sm"
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <UsageDisclaimer />
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
      <p>Use as directed for your product type.</p>
      <UsageDisclaimer />
    </div>
  );
}
