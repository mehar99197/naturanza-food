"use client";

// "use client": a controlled email field with idle/loading/success/error state.

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

import { newsletterAPI } from "@/lib/api/newsletter";

type SubscribeState = "idle" | "loading" | "success" | "error";

/**
 * The mid-article subscribe box, unchanged from BlogPost.jsx's `NewsletterCTA`.
 *
 * The post title is passed through as the subscription's `source`, so the
 * admin list still shows which article won the signup.
 */
export function BlogNewsletterCta({ sourceTitle }: { sourceTitle: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubscribeState>("idle");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;

    setState("loading");
    try {
      await newsletterAPI.subscribe(email.trim(), `blog:${sourceTitle}`);
      setState("success");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-700 via-green-600 to-emerald-600 p-7 sm:p-9 text-white shadow-lg mb-8">
      <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-white/10 blur-xl" />
      <p className="text-xs font-bold uppercase tracking-widest text-green-200 mb-1">
        Naturanza Journal
      </p>
      <h3 className="text-xl sm:text-2xl font-bold mb-2">Get our next article in your inbox</h3>
      <p className="text-green-100/90 text-sm mb-5">
        Tips on natural food, traditional remedies, and healthy living — no spam, unsubscribe anytime.
      </p>
      {state === "success" ? (
        <p className="flex items-center gap-2 font-semibold text-green-100">
          <Check className="h-5 w-5" /> Check your email to confirm!
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="your@email.com"
            className="flex-1 rounded-xl bg-white/15 border border-white/20 px-4 py-2.5 text-sm text-white placeholder-white/50 backdrop-blur-sm outline-none focus:border-white/50 focus:bg-white/20"
          />
          <button
            type="submit"
            disabled={state === "loading"}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-green-700 transition hover:bg-green-50 disabled:opacity-60"
          >
            {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Subscribe
          </button>
        </form>
      )}
      {state === "error" && (
        <p className="mt-2 text-xs text-red-200">Something went wrong — please try again.</p>
      )}
    </div>
  );
}
