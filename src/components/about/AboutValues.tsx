"use client";

// "use client": reveal-on-scroll plus the mobile auto-scrolling card track.

import {
  Award,
  BadgeCheck,
  Droplet,
  Globe,
  HandHeart,
  Heart,
  Leaf,
  Recycle,
  Shield,
  Sparkles,
  Sprout,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useScrollReveal } from "@/hooks/useScrollReveal";

import type { AboutValueIconName, AboutValuesContent } from "./types";
import { useAutoScrollCarousel } from "./useAutoScrollCarousel";

/**
 * Value-card icon map. The key type is the whitelist itself, so adding a name to
 * `ABOUT_VALUE_ICONS` without importing its icon here is a compile error rather
 * than a blank card at runtime.
 */
const ICON_MAP: Record<AboutValueIconName, LucideIcon> = {
  Leaf,
  Heart,
  Globe,
  Shield,
  Award,
  Sparkles,
  Sprout,
  Sun,
  Droplet,
  Recycle,
  HandHeart,
  BadgeCheck,
};

export function AboutValues({ values }: { values: AboutValuesContent }) {
  const { ref: valuesRef, isVisible: valuesVisible } = useScrollReveal<HTMLElement>();
  const valuesTrackRef = useAutoScrollCarousel<HTMLDivElement>(values.items.length);

  return (
    <section className="section-padding bg-[#faf8f3] relative" ref={valuesRef}>
      <div className="container-custom">
        <div className={`text-center mb-8 sm:mb-12 md:mb-16 reveal reveal-left ${valuesVisible ? 'active' : ''}`}>
          <span className="text-[#3d7a3d] font-medium text-sm uppercase tracking-wider">
            {values.eyebrow}
          </span>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[#2d3a2d] mt-2 mb-3">
            {values.heading}
          </h2>
        </div>

        <div
          ref={valuesTrackRef}
          className="flex flex-nowrap overflow-x-auto gap-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-8 pb-2 sm:pb-4 md:pb-4 scrollbar-hide snap-x snap-mandatory scroll-smooth md:overflow-visible md:snap-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {values.items.map((value, index) => {
            const Icon = ICON_MAP[value.icon];
            return (
              <div
                key={`${value.title}-${index}`}
                className={`bg-white rounded-2xl p-5 sm:p-6 md:p-8 text-center shadow-lg hover:shadow-2xl [1.02] border border-gray-100 hover:border-green-200 relative reveal reveal-right ${valuesVisible ? 'active' : ''} snap-center flex-shrink-0 w-full min-w-full md:w-auto md:min-w-0 md:max-w-none`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-11 h-11 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-[#3d7a3d]/10 rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-6">
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-[#3d7a3d]" />
                </div>
                <h3 className="font-display text-base md:text-xl font-semibold text-[#2d3a2d] mb-2.5 md:mb-4">
                  {value.title}
                </h3>
                <p className="text-[#6b7a6b] text-sm md:text-base lg:text-[17px] leading-7 md:leading-relaxed lg:leading-8">
                  {value.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
