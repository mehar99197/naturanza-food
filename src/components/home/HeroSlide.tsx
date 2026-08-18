"use client";

// "use client": the copy block is a framer-motion stagger, and the product
// image needs an onError listener to fall back to the logo.

import { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { fadeIn, slideUp, staggerContainer } from "@/lib/animations";

import type { HeroChip } from "./heroChips";
import {
  FALLBACK_HERO_IMAGE,
  HIGHLIGHTED_HEADLINE_WORDS,
  resolveSlideImage,
  type HeroSlideData,
} from "./heroSlides";

export interface HeroSlideProps {
  slide: HeroSlideData;
  index: number;
  currentSlide: number;
  /** Remount key for the copy block; changing it replays the stagger. */
  textKey: number;
  /**
   * ⚠ These are the *active* slide's chips, on every slide. See Hero.tsx — the
   * behaviour is the source's and is preserved deliberately.
   */
  chips: HeroChip[];
}

/**
 * One slide of the hero carousel.
 *
 * All slides stay mounted and are moved with opacity + translate, which is why
 * the position classes below branch three ways: the active slide sits at x=0,
 * earlier ones are parked off the left edge and later ones off the right, so the
 * transition always runs in the direction the reader expects.
 */
export function HeroSlide({ slide, index, currentSlide, textKey, chips }: HeroSlideProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const slideImage = resolveSlideImage(slide.image, slide.headline);

  return (
    <div
      className={`absolute inset-0 transition-all duration-700 ease-in-out ${
        index === currentSlide
          ? 'opacity-100 translate-x-0 z-10'
          : index < currentSlide
          ? 'opacity-0 -translate-x-full z-0'
          : 'opacity-0 translate-x-full z-0'
      }`}
      aria-hidden={index !== currentSlide}
    >
      {/* Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${slide.bgGradient}`} />

      {/* Decorative Pattern Overlay */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0,0,0,0.2) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Floating Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-white/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-white/20 rounded-full blur-3xl" style={{ animationDelay: '1s' }} />
      </div>

      {/* Content Container */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-4 h-full relative z-20">
        {/*
          Mobile: flex-col — Image top, text+CTA below, dots directly after buttons.
          Desktop (lg+): 2-column grid, dots absolute at bottom.
        */}
        <div className="flex flex-col justify-start sm:justify-center lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center h-full gap-2 sm:gap-3 pt-2 pb-4 sm:pt-6 sm:pb-10 md:py-8 lg:py-0 px-8 sm:px-10 md:px-12 lg:px-16">

          {/* Product Image — top on mobile, right on desktop */}
          <div className="flex items-center justify-center order-1 lg:order-2 lg:h-full py-2">
            <div className="relative w-full max-w-[140px] sm:max-w-xs md:max-w-md lg:max-w-lg mx-auto pt-1">
              <div className={`absolute inset-0 bg-gradient-to-r ${slide.accentColor} opacity-10 blur-3xl rounded-full`} />
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image
                  needs intrinsic dimensions this has none of (max-h + h-auto +
                  object-contain), and would wrap it in a positioned box. */}
              <img
                src={imageFailed ? FALLBACK_HERO_IMAGE : slideImage}
                alt={slide.headline}
                onError={() => setImageFailed(true)}
                className="relative z-10 w-full h-auto object-contain drop-shadow-2xl max-h-[150px] sm:max-h-[220px] md:max-h-[340px] lg:max-h-[400px]"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            </div>
          </div>

          {/* Text + CTA — below image on mobile, left on desktop */}
          <motion.div
            key={textKey}
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="text-center lg:text-left order-2 lg:order-1 space-y-2 sm:space-y-3 md:space-y-4 lg:space-y-6"
          >
            {/* Badge */}
            <motion.div
              variants={fadeIn}
              className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2 py-0.5 md:px-3 md:py-1.5 rounded-full shadow-md"
            >
              <Sparkles className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-green-600 flex-shrink-0" />
              <span className="text-xs font-bold bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">
                {slide.badge}
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={slideUp}
              className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight"
            >
              <span className="text-[#243447] drop-shadow-sm">
                {slide.headline.split(' ').map((word, i) => {
                  const normalizedWord = word.toLowerCase().replace(/[^a-z]/g, '');
                  const isHighlightedWord = HIGHLIGHTED_HEADLINE_WORDS.has(normalizedWord);
                  return (
                    <span
                      key={i}
                      className={`inline-block mr-[0.25em] ${isHighlightedWord ? 'text-[#16A34A]' : ''}`}
                    >
                      {word}
                    </span>
                  );
                })}
              </span>
            </motion.h1>

            {/* Description */}
            <motion.p
              variants={fadeIn}
              className="text-sm sm:text-base md:text-base lg:text-lg text-green-950/70 max-w-xl mx-auto lg:mx-0 leading-relaxed line-clamp-2 sm:line-clamp-none"
            >
              {slide.description}
            </motion.p>

            {/* Chips */}
            {chips.length > 0 ? (
              <motion.div
                variants={fadeIn}
                className="flex flex-wrap items-center justify-center gap-2 lg:justify-start"
              >
                {chips.map((chip) => {
                  const ChipIcon = chip.Icon;
                  return (
                    <span
                      key={chip.key}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:text-xs ${chip.classes}`}
                    >
                      {ChipIcon ? <ChipIcon className="h-3.5 w-3.5" /> : null}
                      <span className="truncate">{chip.label}</span>
                    </span>
                  );
                })}
              </motion.div>
            ) : null}

            {/* CTA Buttons */}
            <motion.div
              variants={slideUp}
              className="flex flex-row items-center gap-2 md:gap-3 justify-center lg:justify-start"
            >
              <Link
                href={slide.linkPrimary}
                className={`btn-3d inline-flex items-center justify-center gap-1.5 bg-gradient-to-r ${slide.accentColor} text-white px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 rounded-lg md:rounded-xl font-semibold text-[13px] sm:text-base md:text-sm lg:text-base shadow-lg md:hover:shadow-3d-hover md:hover:-translate-y-0.5 active:scale-95 transition-all duration-300 group min-h-[40px] whitespace-nowrap`}
              >
                <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                <span>{slide.ctaPrimary}</span>
              </Link>
              <Link
                href={slide.linkSecondary}
                className="inline-flex items-center justify-center gap-1.5 bg-white/90 backdrop-blur-sm text-gray-800 px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 rounded-lg md:rounded-xl font-semibold text-[13px] sm:text-base md:text-sm lg:text-base border-2 border-gray-200 shadow-md md:hover:shadow-xl md:hover:border-gray-300 md:hover:-translate-y-0.5 active:scale-95 transition-all duration-300 min-h-[40px] whitespace-nowrap"
              >
                {slide.ctaSecondary}
              </Link>
            </motion.div>

          </motion.div>
        </div>
      </div>
    </div>
  );
}
