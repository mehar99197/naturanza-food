"use client";

// "use client": the counters run off an IntersectionObserver and a
// requestAnimationFrame loop.

import { useEffect, useRef, useState } from "react";

import type { AboutStat } from "./types";

/** Timings copied from the source: total run, and the head start each tile gets. */
const DURATION_MS = 4200;
const STAGGER_MS = 220;
/** Fraction of the band that must be on screen before the counters start. */
const START_THRESHOLD = 0.3;

/**
 * The green stats band.
 *
 * Each number counts up from zero once the band scrolls into view, with a
 * quintic ease-out and a per-tile stagger. It renders `0` on the server, which
 * is what the SPA painted before its own observer fired, so hydration matches.
 */
export function AboutStats({ stats }: { stats: AboutStat[] }) {
  const statsSectionRef = useRef<HTMLElement | null>(null);
  const [animatedStats, setAnimatedStats] = useState<number[]>(() => stats.map(() => 0));
  const [statsAnimationStarted, setStatsAnimationStarted] = useState(false);

  useEffect(() => {
    const section = statsSectionRef.current;
    if (!section || statsAnimationStarted) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setStatsAnimationStarted(true);
          observer.disconnect();
        }
      },
      { threshold: START_THRESHOLD },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [statsAnimationStarted]);

  useEffect(() => {
    if (!statsAnimationStarted) return;
    let animationFrameId: number | undefined;
    const startTime = performance.now();

    const animate = (now: number) => {
      const nextValues = stats.map((stat, index) => {
        const elapsed = now - startTime - index * STAGGER_MS;
        if (elapsed <= 0) return 0;
        const progress = Math.min(1, elapsed / DURATION_MS);
        const easedProgress = 1 - Math.pow(1 - progress, 5);
        return Math.round((Number(stat.value) || 0) * easedProgress);
      });
      setAnimatedStats(nextValues);
      const isComplete = stats.every(
        (_, index) => now - startTime - index * STAGGER_MS >= DURATION_MS,
      );
      if (!isComplete) animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [statsAnimationStarted, stats]);

  return (
    <section ref={statsSectionRef} className="py-10 sm:py-12 md:py-16 bg-[#3d7a3d]">
      <div className="container-custom">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 sm:gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <div
              key={`${stat.label}-${index}`}
              className="text-center"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2">
                {`${animatedStats[index] ?? 0}${stat.suffix || ''}`}
              </div>
              <div className="text-white/80 text-xs sm:text-sm md:text-base">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
