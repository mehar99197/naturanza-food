import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Info, Sparkles, Tag, X } from "lucide-react";
import { announcementAPI } from "@/services/api";

const DISMISSED_STORAGE_KEY = "naturanza:announcements:dismissed";
const ROTATION_INTERVAL_MS = 5000;
const BAR_HEIGHT = "40px";

const typeStyles = {
  info: {
    shell:
      "border-emerald-200/70 bg-white/90 text-emerald-900 shadow-[0_8px_18px_rgba(16,185,129,0.12)]",
    icon: "bg-emerald-100 text-emerald-700",
    titlePill: "bg-emerald-100 text-emerald-800",
    message: "text-emerald-900/90",
    counter: "bg-emerald-100/70 text-emerald-800",
    dismiss: "hover:bg-emerald-50/80",
    Icon: Info,
  },
  success: {
    shell:
      "border-emerald-200/70 bg-emerald-50/80 text-emerald-900 shadow-[0_8px_18px_rgba(16,185,129,0.12)]",
    icon: "bg-emerald-200/70 text-emerald-800",
    titlePill: "bg-emerald-200/70 text-emerald-900",
    message: "text-emerald-900/90",
    counter: "bg-emerald-200/70 text-emerald-900",
    dismiss: "hover:bg-emerald-100/70",
    Icon: Tag,
  },
  warning: {
    shell:
      "border-amber-200/70 bg-amber-50/85 text-amber-900 shadow-[0_8px_18px_rgba(217,119,6,0.12)]",
    icon: "bg-amber-100 text-amber-700",
    titlePill: "bg-amber-100 text-amber-900",
    message: "text-amber-900/90",
    counter: "bg-amber-100/80 text-amber-800",
    dismiss: "hover:bg-amber-100/60",
    Icon: AlertCircle,
  },
  danger: {
    shell:
      "border-rose-200/70 bg-rose-50/85 text-rose-900 shadow-[0_8px_18px_rgba(225,29,72,0.12)]",
    icon: "bg-rose-100 text-rose-700",
    titlePill: "bg-rose-100 text-rose-900",
    message: "text-rose-900/90",
    counter: "bg-rose-100/80 text-rose-800",
    dismiss: "hover:bg-rose-100/60",
    Icon: AlertCircle,
  },
  promotion: {
    shell:
      "border-emerald-600/30 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-[0_12px_26px_rgba(16,185,129,0.24)]",
    icon: "bg-white/15 text-amber-200",
    titlePill: "bg-white/15 text-amber-100",
    message: "text-white",
    counter: "bg-white/15 text-white",
    dismiss: "hover:bg-white/10",
    Icon: Sparkles,
  },
};

const slideTransition = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
};

const readDismissedState = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(DISMISSED_STORAGE_KEY) === "true";
};

const truncateText = (value) => String(value || "").trim();

export default function AnnouncementBar() {
  const [announcements, setAnnouncements] = useState([]);
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
        const response = await announcementAPI.getActive();
        if (!isMounted) return;

        const list = Array.isArray(response) ? response : [];
        setAnnouncements(list);
        setCurrentIndex(0);
      } catch (requestError) {
        if (!isMounted) return;
        setAnnouncements([]);
        setError(requestError?.response?.data?.error || "Announcements unavailable");
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

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    document.documentElement.style.setProperty(
      "--announcement-bar-height",
      shouldRender && !loading && !dismissed && announcements.length > 0 ? BAR_HEIGHT : "0px",
    );

    return () => {
      document.documentElement.style.setProperty("--announcement-bar-height", "0px");
    };
  }, [shouldRender, loading, dismissed, announcements.length]);

  const handleDismiss = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DISMISSED_STORAGE_KEY, "true");
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
  const presentation =
    typeStyles[currentAnnouncement?.type] || typeStyles.info;
  const Icon = presentation.Icon;

  return (
    <div className="sticky top-0 z-[60]">
      <div className="container-custom">
        <div
          className={`flex min-h-[38px] items-center gap-2.5 rounded-b-2xl border px-3 shadow-[0_8px_18px_rgba(15,64,28,0.08)] backdrop-blur-md md:min-h-[40px] md:gap-3 ${presentation.shell}`}
        >
          <span
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${presentation.icon}`}
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
                className="flex items-center gap-2 overflow-hidden"
              >
                {currentAnnouncement.title ? (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${presentation.titlePill}`}
                  >
                    {truncateText(currentAnnouncement.title)}
                  </span>
                ) : null}
                <p
                  className={`truncate text-[12px] font-medium leading-tight sm:text-[13px] ${presentation.message}`}
                >
                  {truncateText(currentAnnouncement.message)}
                </p>
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
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-current transition-colors duration-200 ${presentation.dismiss}`}
            aria-label="Dismiss announcements"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
