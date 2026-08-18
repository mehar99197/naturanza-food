"use client";

/**
 * The desktop gallery: a vertical thumbnail rail on the left, the large photo
 * on a gradient card to its right, with the "100% ORGANIC" seal pinned to the
 * card's top-right corner.
 *
 * Client-side for the same reasons as the mobile gallery — selected-image state
 * and the `onError` fallback swap — and it uses plain `<img>` for the same
 * reason: that is what the SPA rendered, at sizes the CSS controls.
 */

import { ChevronLeft, ChevronRight, Leaf } from "lucide-react";

import { FALLBACK_IMAGE } from "./constants";
import { swapToFallbackImage, useGalleryNavigation } from "./useGalleryNavigation";

export interface ProductGalleryDesktopProps {
  images: string[];
  productName: string;
}

export function ProductGalleryDesktop({ images, productName }: ProductGalleryDesktopProps) {
  const { activeImage, setActiveImage, showPrevious, showNext } = useGalleryNavigation(
    images.length,
  );

  return (
    <div className="flex gap-4">
      {/* Vertical Thumbnail Gallery - Left Side */}
      <div className="flex flex-col gap-3 w-24">
        {images.map((img, index) => (
          <button
            key={`${img}-${index}`}
            type="button"
            onClick={() => setActiveImage(index)}
            className={`aspect-square overflow-hidden rounded-xl border bg-white p-2 transition-all ${
              index === activeImage
                ? "border-emerald-500 ring-2 ring-emerald-200 shadow-md"
                : "border-gray-200 hover:border-emerald-300"
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

      {/* Main Image - Center */}
      <div className="flex-1 rounded-2xl border border-gray-300 bg-gradient-to-br from-[#9CA896] to-[#8B9A7E] p-8 shadow-sm relative overflow-hidden">
        {/* 100% Organic Badge */}
        <div className="absolute top-6 right-6 z-10">
          <div className="flex flex-col items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-[#5a7a4a] to-[#4a6a3a] border-4 border-white text-white shadow-xl">
            <Leaf className="h-7 w-7 mb-0.5" strokeWidth={2.5} />
            <span className="text-[11px] font-bold leading-tight text-center tracking-tight">
              100%
              <br />
              ORGANIC
            </span>
          </div>
        </div>

        <div className="relative aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[activeImage] ?? FALLBACK_IMAGE}
            alt={productName}
            className="w-full h-full object-contain"
            onError={swapToFallbackImage}
          />
        </div>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={showPrevious}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-gray-300 bg-white/95 p-2 text-gray-700 shadow-md hover:bg-white hover:shadow-lg transition-all"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={showNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-gray-300 bg-white/95 p-2 text-gray-700 shadow-md hover:bg-white hover:shadow-lg transition-all"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
