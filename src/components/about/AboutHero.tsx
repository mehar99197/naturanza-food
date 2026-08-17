"use client";

// "use client": the reveal-on-scroll animation needs an IntersectionObserver.
// The copy itself is server-rendered into the HTML — only the `active` class
// that fades it in is decided in the browser.

import { useScrollReveal } from "@/hooks/useScrollReveal";

import type { AboutHeroContent } from "./types";

export function AboutHero({ hero }: { hero: AboutHeroContent }) {
  const { ref: heroRef, isVisible: heroVisible } = useScrollReveal();

  return (
    <section className="section-padding pt-0 bg-gradient-to-br from-[#e8f0e8] to-[#faf8f3]">
      <div
        className={`container-custom text-center reveal reveal-left ${heroVisible ? 'active' : ''}`}
        ref={heroRef}
      >
        <span className="inline-block mt-4 sm:mt-5 text-[#3d7a3d] font-medium text-[10px] sm:text-sm uppercase tracking-wider">
          {hero.eyebrow}
        </span>
        <h1 className="font-display text-[2rem] leading-tight sm:text-3xl md:text-[2.25rem] lg:text-4xl xl:text-5xl font-bold text-[#2d3a2d] mt-3 md:mt-4 mb-4 md:mb-6">
          {hero.titleTop}
          <br />
          <span className="text-[#3d7a3d]">{hero.titleHighlight}</span>
        </h1>
        <p className="text-[13px] sm:text-sm md:text-base text-[#6b7a6b] max-w-2xl mx-auto px-4">
          {hero.subtitle}
        </p>
      </div>
    </section>
  );
}
