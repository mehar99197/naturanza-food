"use client";

// "use client": a controlled email field with submit, success and error state.

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { newsletterAPI } from "@/lib/api/newsletter";
import { ApiError } from "@/lib/api/errors";

const FEEDBACK_TIMEOUT_MS = 6000;
const ERROR_TIMEOUT_MS = 5000;

/** The `{ error }` envelope Express returns on a 4xx. */
interface NewsletterErrorBody {
  error?: string;
}

interface SubscribeResponse {
  message?: string;
}

/**
 * The newsletter strip across the top of the full footer.
 *
 * Owns all five pieces of subscribe state: nothing above it reads them, and the
 * success and error banners live inside this same bordered section as the form.
 */
export function FooterNewsletter() {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribeMessage, setSubscribeMessage] = useState("");
  const [subscribeError, setSubscribeError] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || isSubscribing) {
      return;
    }
    setIsSubscribing(true);
    setSubscribeError("");
    try {
      const response = await newsletterAPI.subscribe<SubscribeResponse>(
        trimmedEmail,
        "footer",
      );
      setIsSubscribed(true);
      setSubscribeMessage(
        response?.message ||
          "Please check your email to confirm your subscription.",
      );
      setEmail("");
      setTimeout(() => {
        setIsSubscribed(false);
        setSubscribeMessage("");
      }, FEEDBACK_TIMEOUT_MS);
    } catch (error) {
      // `error.response.data.error` in the source; narrowed here because the
      // ported client throws a typed ApiError rather than an axios error.
      const apiError =
        error instanceof ApiError
          ? (error.response?.data as NewsletterErrorBody | undefined)?.error
          : undefined;
      setSubscribeError(apiError || "Could not subscribe. Please try again.");
      setTimeout(() => setSubscribeError(""), ERROR_TIMEOUT_MS);
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="border-b border-white/10 relative z-10">
      <div className="container-custom py-8 md:py-10 lg:py-12">
        <div className="relative rounded-3xl p-[1px] bg-gradient-to-r from-emerald-200/30 via-white/25 to-green-200/30 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
          <div className="rounded-3xl bg-white/[0.05] backdrop-blur-md px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-7">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 lg:gap-10">
              <div className="text-center md:text-left">
                <h3 className="font-display text-lg sm:text-xl md:text-2xl font-black mb-2 md:mb-3 bg-gradient-to-r from-white via-green-100 to-emerald-200 bg-clip-text text-transparent">Join the Naturanza Family</h3>
                <p className="text-white/90 text-xs md:text-sm font-medium">Get exclusive offers and wellness tips delivered to your inbox.</p>
              </div>
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row w-full md:w-auto md:min-w-[360px] gap-2 md:gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={isSubscribing}
                  className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-64 md:w-72 text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={isSubscribing || !email.trim()}
                  className="btn-3d px-4 md:px-5 py-1.5 md:py-2 bg-gradient-to-r from-green-500 via-green-600 to-emerald-600 md:hover:from-green-600 md:hover:to-emerald-700 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shadow-2xl shadow-green-900/50 md:hover:shadow-green-900/70 active:scale-95 transition-all duration-300 md:hover:-translate-y-0.5 md:hover:ring-1 md:hover:ring-emerald-200/70 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubscribing ? 'Subscribing...' : 'Subscribe'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
        {isSubscribed && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2.5 glass-effect px-6 py-3 rounded-2xl border border-green-500/40 shadow-xl">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-green-300 font-bold text-sm">{subscribeMessage || 'Thank you for subscribing!'}</span>
            </div>
          </div>
        )}
        {subscribeError && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-2.5 glass-effect px-6 py-3 rounded-2xl border border-red-500/40 shadow-xl">
              <span className="text-red-200 font-semibold text-sm">{subscribeError}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
