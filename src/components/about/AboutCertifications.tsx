"use client";

// "use client": reveal-on-scroll only.

import { Award } from "lucide-react";

import { useScrollReveal } from "@/hooks/useScrollReveal";

import type { AboutCertificationsContent } from "./types";

export function AboutCertifications({
  certifications,
}: {
  certifications: AboutCertificationsContent;
}) {
  const { ref: certRef, isVisible: certVisible } = useScrollReveal({ threshold: 0.2 });

  return (
    <section className="pt-10 sm:pt-12 lg:pt-12 xl:pt-14 pb-6 sm:pb-6 lg:pb-6 xl:pb-6 bg-[#faf8f3]">
      <div className="container-custom">
        <div className={`text-center mb-7 sm:mb-10 md:mb-12 reveal reveal-left ${certVisible ? 'active' : ''}`} ref={certRef}>
          <h2 className="font-display text-xl md:text-2xl font-bold text-[#2d3a2d] mb-2">
            {certifications.heading}
          </h2>
          <p className="text-[#6b7a6b] text-sm md:text-base">
            {certifications.subtitle}
          </p>
        </div>

        <div className={`grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2.5 sm:gap-3 md:gap-6 lg:gap-8 reveal reveal-right ${certVisible ? 'active' : ''}`}>
          {certifications.items.map((cert) => (
            <div
              key={cert}
              className="min-h-[44px] flex items-center justify-center gap-2 md:gap-3 bg-white px-2.5 sm:px-4 md:px-6 py-2.5 md:py-4 rounded-xl shadow-md hover:shadow-xl"
            >
              <Award className="w-5 h-5 md:w-6 md:h-6 text-[#3d7a3d] flex-shrink-0" />
              <span className="font-medium text-[#2d3a2d] text-[12px] leading-5 text-center sm:text-sm md:text-base">{cert}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
