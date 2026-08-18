"use client";

// "use client": every element here is a button with a click handler.

import { ChevronLeft, ChevronRight } from "lucide-react";

import type { HeroSlideData } from "./heroSlides";

export interface HeroControlsProps {
  slides: HeroSlideData[];
  currentSlide: number;
  /** Arrows and dots are all disabled mid-transition, as in the source. */
  isAnimating: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
}

/**
 * Previous/next arrows and the pagination dots.
 *
 * Rendered as a sibling of the slides rather than inside them — the comment in
 * the source explains why: anything inside a slide inherits its translate, so
 * the dots would slide off with the outgoing content.
 *
 * The caller decides whether to render this at all (only when there is more than
 * one slide), matching the source's `shouldShowNav`.
 */
export function HeroControls({
  slides,
  currentSlide,
  isAnimating,
  onPrev,
  onNext,
  onGoTo,
}: HeroControlsProps) {
  return (
    <>
      {/* Navigation Arrows */}
      <button
        onClick={onPrev}
        disabled={isAnimating}
        className="absolute left-2 sm:left-3 md:left-4 lg:left-6 top-1/2 -translate-y-1/2 z-40 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-lg md:hover:shadow-2xl md:hover:scale-105 transition-all duration-300 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        aria-label="Previous slide"
        style={{ transform: 'translateY(-50%)' }}
      >
        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-700 md:group-hover:text-green-600 transition-colors duration-300" />
      </button>

      <button
        onClick={onNext}
        disabled={isAnimating}
        className="absolute right-2 sm:right-3 md:right-4 lg:right-6 top-1/2 -translate-y-1/2 z-40 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-lg md:hover:shadow-2xl md:hover:scale-105 transition-all duration-300 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        aria-label="Next slide"
        style={{ transform: 'translateY(-50%)' }}
      >
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-700 md:group-hover:text-green-600 transition-colors duration-300" />
      </button>

      {/* Pagination Dots — all screen sizes, outside slides so they never animate with content */}
      <div className="absolute bottom-4 sm:bottom-4 md:bottom-6 lg:bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 bg-white/80 backdrop-blur-sm px-2 py-1 sm:px-3 sm:py-2 rounded-full shadow-md">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => onGoTo(index)}
            disabled={isAnimating}
            className={`transition-all duration-300 rounded-full disabled:cursor-not-allowed ${
              index === currentSlide
                ? 'w-4 sm:w-6 lg:w-8 h-2 bg-green-500 shadow-sm'
                : 'w-2 h-2 bg-gray-300/80 hover:bg-gray-400 active:scale-110'
            }`}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === currentSlide ? 'true' : 'false'}
          />
        ))}
      </div>
    </>
  );
}
