"use client";

/**
 * The phone gallery: one large photo with prev/next arrows, and a horizontal
 * thumbnail strip beneath it.
 *
 * "use client" because it owns the selected-image state and the `onError`
 * fallback swap.
 *
 * These are plain `<img>` elements, not next/image or OptimizedImage, because
 * that is what the SPA rendered. Neither the main photo (`aspect-square w-full
 * max-w-[380px]`) nor the thumbnails declare intrinsic dimensions, and swapping
 * in a component that wraps the image in its own positioned container would
 * change the DOM this page's CSS is written against.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

import { FALLBACK_IMAGE } from "./constants";
import { swapToFallbackImage, useGalleryNavigation } from "./useGalleryNavigation";

export interface ProductGalleryMobileProps {
  images: string[];
  productName: string;
}

export function ProductGalleryMobile({ images, productName }: ProductGalleryMobileProps) {
  const { activeImage, setActiveImage, showPrevious, showNext } = useGalleryNavigation(
    images.length,
  );

  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
      <div className="relative rounded-xl bg-[#f8faf7] p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[activeImage] ?? FALLBACK_IMAGE}
          alt={productName}
          className="mx-auto aspect-square w-full max-w-[380px] object-contain"
          onError={swapToFallbackImage}
        />

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={showPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-1.5 text-gray-700"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={showNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-1.5 text-gray-700"
              aria-label="Next image"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>

      <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto pb-1">
        {images.map((img, index) => (
          <button
            key={`${img}-${index}`}
            type="button"
            onClick={() => setActiveImage(index)}
            className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white p-1 ${
              index === activeImage
                ? "border-emerald-500 ring-1 ring-emerald-300"
                : "border-gray-200"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={`${productName} thumbnail ${index + 1}`}
              className="h-full w-full object-contain"
              onError={swapToFallbackImage}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
