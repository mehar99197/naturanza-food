"use client";

/**
 * Dismissible announcement bar, ported from frontend/src/components/AnnouncementBar.jsx.
 *
 * No routing to migrate — it renders no links — so the port is the original plus
 * types. Two things are worth knowing before editing it:
 *
 *  - It publishes its own height to `--announcement-bar-height`, which the fixed
 *    header reads for its `top`. Break that and the nav overlaps the bar.
 *  - `dismissed` is seeded from sessionStorage during the first render, which
 *    would normally be a hydration hazard. It is safe only because `loading`
 *    starts true and the component returns null on that first render either way.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, X } from "lucide-react";

import { announcementAPI } from "@/lib/api/announcements";
import { ApiError } from "@/lib/api/errors";
import { safeSessionStorage } from "@/lib/storage";

import { resolvePresentation, type Announcement } from "./announcementBarStyles";

export type { Announcement } from "./announcementBarStyles";

const DISMISSED_STORAGE_KEY = "naturanza:announcements:dismissed";
const ROTATION_INTERVAL_MS = 5000;

const slideTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: {
    duration: 0.28,
    ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  },
};

const readDismissedState = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return safeSessionStorage.getItem(DISMISSED_STORAGE_KEY) === "true";
};

const truncateText = (value: string | null | undefined): string =>
  String(value || "").trim();

export function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(readDismissedState());

  useEffect(() => {
    if (dismissed) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const loadAnnouncements = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await announcementAPI.getActive<Announcement[]>();
        if (!isMounted) return;

        const list = Array.isArray(response) ? response : [];
        setAnnouncements(list);
        setCurrentIndex(0);
      } catch (requestError) {
        if (!isMounted) return;
        setAnnouncements([]);
        const body =
          requestError instanceof ApiError
            ? (requestError.response?.data as { error?: string } | undefined)
            : undefined;
        setError(body?.error || "Announcements unavailable");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAnnouncements();

    return () => {
      isMounted = false;
    };
  }, [dismissed]);

  useEffect(() => {
    if (dismissed || announcements.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [announcements.length, dismissed]);

  const shouldRender = useMemo(() => {
    if (dismissed) return false;
    if (loading) return false;
    if (error) return true;
    return announcements.length > 0;
  }, [announcements.length, dismissed, error, loading]);

  const barRef = useRef<HTMLDivElement | null>(null);

  // Publishes the measured height so the fixed header can sit below the bar.
  // A ResizeObserver rather than a one-off read, because the marquee text
  // rewraps on rotation and on orientation change.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const isVisible = shouldRender && !loading && !dismissed && announcements.length > 0;
    if (!isVisible) {
      document.documentElement.style.setProperty("--announcement-bar-height", "0px");
      return undefined;
    }

    const el = barRef.current;
    if (!el) return undefined;

    const sync = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--announcement-bar-height", `${h}px`);
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty("--announcement-bar-height", "0px");
    };
  }, [shouldRender, loading, dismissed, announcements.length]);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      safeSessionStorage.setItem(DISMISSED_STORAGE_KEY, "true");
    }

    setDismissed(true);
  };

  if (loading) {
    return null;
  }

  if (!shouldRender) {
    return null;
  }

  if (error) {
    return (
      <div className="sticky top-0 z-[60]">
        <div className="container-custom">
          <div className="flex min-h-[38px] items-center gap-2.5 rounded-b-2xl border border-amber-200/70 bg-amber-50/85 px-3 shadow-[0_8px_18px_rgba(217,119,6,0.12)] backdrop-blur-md md:min-h-[40px]">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" />
            </span>
            <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-amber-900 sm:text-[13px]">
              {error}
            </p>
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-amber-800 transition-colors duration-200 hover:bg-amber-100/60"
              aria-label="Dismiss announcements"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentAnnouncement = announcements[currentIndex];
  // Unreachable given `shouldRender` above, but `noUncheckedIndexedAccess`
  // rightly refuses to assume an array index is populated.
  if (!currentAnnouncement) return null;
  const presentation = resolvePresentation(currentAnnouncement.type);
  const Icon = presentation.Icon;

  return (
    <div className="sticky top-0 z-[60] overflow-x-hidden w-full">
      <style>{`
        @keyframes nzMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .nz-marquee-track { animation: nzMarquee 18s linear infinite; will-change: transform; }
        .nz-marquee-viewport:hover .nz-marquee-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .nz-marquee-track { animation: none; } }
      `}</style>
      <div
        ref={barRef}
        className={`flex min-h-[38px] w-full items-center gap-1.5 border-b px-3 shadow-[0_4px_12px_rgba(15,64,28,0.10)] backdrop-blur-md sm:gap-2.5 sm:px-4 md:min-h-[40px] md:gap-3 ${presentation.shell} rounded-none border-x-0 border-t-0`}
      >
        {/* Icon — hidden on xs so title pill + marquee + X have room */}
        <span
          className={`hidden sm:inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${presentation.icon}`}
        >
          <Icon
            className={`h-3.5 w-3.5 ${
              currentAnnouncement.type === "promotion" ? "animate-pulse" : ""
            }`}
          />
        </span>

        <div className="min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentAnnouncement.id}
              {...slideTransition}
              className="flex items-center gap-1.5 sm:gap-2 overflow-hidden"
            >
              {currentAnnouncement.title ? (
                <span
                  className={`shrink-0 max-w-[100px] truncate rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.07em] sm:max-w-none sm:px-2.5 sm:text-[10px] sm:tracking-[0.08em] ${presentation.titlePill}`}
                >
                  {truncateText(currentAnnouncement.title)}
                </span>
              ) : null}
              {/* Marquee scrolls the full message on narrow screens */}
              <div className="nz-marquee-viewport min-w-0 flex-1 overflow-hidden">
                <div className="nz-marquee-track flex w-max whitespace-nowrap">
                  <span
                    className={`pr-12 text-[11px] font-medium leading-tight sm:pr-16 sm:text-[13px] ${presentation.message}`}
                  >
                    {truncateText(currentAnnouncement.message)}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`pr-12 text-[11px] font-medium leading-tight sm:pr-16 sm:text-[13px] ${presentation.message}`}
                  >
                    {truncateText(currentAnnouncement.message)}
                  </span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {announcements.length > 1 ? (
          <span className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:inline-flex ${presentation.counter}`}>
            {currentIndex + 1}/{announcements.length}
          </span>
        ) : null}

        <button
          type="button"
          onClick={handleDismiss}
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-current transition-colors duration-200 sm:h-8 sm:w-8 sm:rounded-xl ${presentation.dismiss}`}
          aria-label="Dismiss announcements"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      </div>
    </div>
  );
}

export default AnnouncementBar;
