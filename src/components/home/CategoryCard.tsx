import Link from "next/link";
import { Tag } from "lucide-react";

import { ImageWithFallback } from "@/components/blog/ImageWithFallback";

import { CATEGORY_FALLBACK_IMAGE, type HomeCategoryCard } from "./categoryCards";

/**
 * One "Shop by Category" tile.
 *
 * A Server Component. Only the image needs a client listener — the source
 * swapped `src` from an `onError` handler — and that is `ImageWithFallback`, a
 * single `<img>` that does exactly this and nothing else.
 *
 * The link is `/shop?category=<id>`, by id and not by slug, matching the source.
 * The shop page reads that param; changing it to a slug is a shop-page decision.
 *
 * `index` only feeds the staggered entry animation.
 */
export function CategoryCard({
  category,
  index,
}: {
  category: HomeCategoryCard;
  index: number;
}) {
  return (
    <Link
      href={`/shop?category=${category.id}`}
      style={{ animationDelay: `${index * 100}ms` }}
      className="group snap-center flex-shrink-0 w-full min-w-full md:w-auto md:min-w-0 relative overflow-hidden rounded-lg md:rounded-xl bg-white border-2 border-green-100 shadow-md md:hover:shadow-2xl md:hover:-translate-y-2 md:hover:border-green-300 transition-all duration-500 ease-out animate-fade-in-up opacity-0 [animation-fill-mode:forwards]"
    >
      <div className="h-44 sm:h-48 md:h-64 lg:h-72 bg-white relative flex items-center justify-center p-2 sm:p-3 md:p-4 overflow-hidden">
        {category.image ? (
          <ImageWithFallback
            src={category.image}
            fallbackSrc={CATEGORY_FALLBACK_IMAGE}
            alt={category.name}
            className="h-full w-full object-contain transition-transform duration-500 ease-out md:group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-emerald-700/75">
            <Tag className="h-6 w-6" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
              No image
            </span>
          </div>
        )}
      </div>
      <div className="p-2.5 md:p-3.5 lg:p-3">
        <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1 md:mb-1.5 line-clamp-1">
          {category.name}
        </h3>
        <p className="text-gray-600 mb-2 md:mb-2.5 leading-relaxed text-xs line-clamp-2">
          {category.description || 'No description added yet.'}
        </p>
        <span className="inline-flex items-center gap-1 md:gap-1.5 text-green-700 font-bold text-xs group-hover:gap-2 transition-all duration-300">
          Explore Collection
          <svg
            className="w-3 h-3 md:w-3.5 md:h-3.5 transition-transform duration-300 md:group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}
