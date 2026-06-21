import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Sparkles, Tag, ArrowRight } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';

const STORAGE_KEY = 'naturanza:sale-popup:dismissed';
const SHOW_DELAY_MS = 1200;

// A professional store-wide-sale popup, shown once per browser session while a
// sale is live. Re-appears automatically if the admin changes the sale (the
// dismissed "signature" = label + percentage, so a new sale re-triggers it).
export function DiscountPopup() {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);

  const active =
    Boolean(settings?.storeDiscountActive) &&
    (Number(settings?.storeDiscountPercentage) || 0) > 0;
  const pct = Math.round(Number(settings?.storeDiscountPercentage) || 0);
  const label = settings?.storeDiscountLabel || 'Store Sale';
  const signature = `${label}|${pct}`;

  useEffect(() => {
    if (!active) {
      setOpen(false);
      return undefined;
    }
    if (typeof window === 'undefined') return undefined;

    let dismissed = '';
    try {
      dismissed = window.sessionStorage.getItem(STORAGE_KEY) || '';
    } catch {
      dismissed = '';
    }
    if (dismissed === signature) return undefined;

    const timer = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, signature]);

  const dismiss = () => {
    setOpen(false);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, signature);
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {open && active && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={dismiss}
          role="dialog"
          aria-modal="true"
          aria-label={`${label} announcement`}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

          {/* Card */}
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.82, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            {/* Close */}
            <button
              onClick={dismiss}
              aria-label="Close"
              className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm backdrop-blur transition hover:bg-white hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Top — gradient burst */}
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 px-6 pt-9 pb-7 text-center text-white">
              {/* glow blobs */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-amber-300/20 blur-2xl" />
              {/* dot grid */}
              <div
                className="pointer-events-none absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }}
              />

              <div className="relative">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 text-amber-200" /> {label}
                </span>

                <div className="mt-4 flex items-end justify-center gap-1.5">
                  <span className="font-display text-6xl font-extrabold leading-none drop-shadow-sm">{pct}%</span>
                  <span className="mb-1 font-display text-2xl font-bold">OFF</span>
                </div>
                <p className="mt-2 text-sm font-medium text-emerald-50/90">
                  Every product, across the whole store — limited time only.
                </p>
              </div>
            </div>

            {/* Bottom — CTA */}
            <div className="px-6 pb-6 pt-5 text-center">
              <p className="text-sm text-slate-500">
                The discount is applied automatically at checkout. No code needed.
              </p>
              <Link
                to="/shop"
                onClick={dismiss}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:from-emerald-600 hover:to-green-700"
              >
                <Tag className="h-4 w-4" /> Shop the Sale <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={dismiss}
                className="mt-3 text-xs font-medium text-slate-400 transition hover:text-slate-600"
              >
                No thanks, maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default DiscountPopup;
