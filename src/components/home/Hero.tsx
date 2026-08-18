"use client";

// "use client": the carousel owns slide/transition state, hover tracking and a
// browser fetch. See the note below on why the fetch stayed on the client.

import { useEffect, useMemo, useState } from "react";

import { productAPI } from "@/lib/api/products";
import { useSettings } from "@/providers/SettingsProvider";

import { buildSlideChips } from "./heroChips";
import { HeroControls } from "./HeroControls";
import { HeroSlide } from "./HeroSlide";
import { sortHoneyFirst, toHeroSlides, type HeroApiProduct, type HeroSlideData } from "./heroSlides";
import { useHeroCarousel } from "./useHeroCarousel";

/**
 * The home page's product carousel, ported from frontend/src/sections/Hero.jsx.
 *
 * WHY THIS STILL FETCHES FROM THE BROWSER, unlike FeaturedProducts and
 * Categories on this page: the slide order is "honey first, then catalog order"
 * across the *whole* catalog, and `productAPI.getAll` walks the catalog in pages
 * of 500. The server reader (`listProducts`) caps a single call at 60 rows and
 * orders by `created_at DESC`, so server-rendering this today would silently
 * change which products appear and in what order. Moving it needs a server query
 * that expresses the honey-first rule — flagged for the integrator rather than
 * decided here.
 *
 * `normalizeProductList` from the source is gone: it accepted either a bare
 * array or a `{ data }` envelope because the old axios service returned whatever
 * the server sent. The ported `productAPI.getAll` always resolves to `{ data }`,
 * so `response.data` is the same value by construction.
 */
export function Hero() {
  const { settings } = useSettings();
  const [slides, setSlides] = useState<HeroSlideData[]>([]);
  const { currentSlide, textKey, isAnimating, next, prev, goTo, setHovered } =
    useHeroCarousel(slides.length);

  useEffect(() => {
    const fetchSlides = async () => {
      try {
        const response = await productAPI.getAll<HeroApiProduct>();
        const list = sortHoneyFirst(response.data);

        if (list.length > 0) {
          setSlides(toHeroSlides(list));
        }
      } catch (err) {
        console.error("Failed to fetch hero slides:", err);
      }
    };
    void fetchSlides();
  }, []);

  const hasSlides = slides.length > 0;
  const shouldShowNav = slides.length > 1;
  const currentSlideData = hasSlides ? slides[currentSlide] ?? null : null;

  // ⚠ PRESERVED BUG: the source computed the chips once, from the *active*
  // slide, and then rendered that one array inside every slide in the map. Off
  // screen it is invisible, but during the 700ms cross-fade the outgoing slide
  // wears the incoming slide's price and rating. Faithful to the source; fixing
  // it means passing each slide its own chips.
  const slideChips = useMemo(
    () => buildSlideChips(currentSlideData, settings),
    [currentSlideData, settings],
  );

  return (
    <section
      className="relative w-full max-w-full h-[540px] sm:h-[460px] md:h-[550px] lg:h-[600px] overflow-hidden overflow-x-hidden pt-[56px] sm:pt-[60px] md:pt-[68px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="region"
      aria-label="Featured products carousel"
    >
      {/* Slides Container */}
      <div className="relative w-full h-full">
        {hasSlides ? (
          slides.map((slide, index) => (
            <HeroSlide
              key={slide.id}
              slide={slide}
              index={index}
              currentSlide={currentSlide}
              textKey={textKey}
              chips={slideChips}
            />
          ))
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-green-50 via-emerald-50 to-green-100"
            aria-hidden="true"
          />
        )}
      </div>

      {shouldShowNav ? (
        <HeroControls
          slides={slides}
          currentSlide={currentSlide}
          isAnimating={isAnimating}
          onPrev={prev}
          onNext={next}
          onGoTo={goTo}
        />
      ) : null}
    </section>
  );
}
