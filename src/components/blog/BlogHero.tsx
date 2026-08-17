import { Newspaper } from "lucide-react";

/** The listing's masthead, unchanged from Blog.jsx. */
export function BlogHero({ postCount }: { postCount: number }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 px-6 py-10 sm:px-10 sm:py-14 text-white shadow-[0_18px_48px_rgba(7,43,24,0.18)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 left-1/3 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
      {/* Subtle dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
          <Newspaper className="h-3.5 w-3.5" /> Naturanza Journal
        </span>
        {postCount > 0 && (
          <span className="ml-2 inline-flex items-center rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">
            {postCount} {postCount === 1 ? "Article" : "Articles"}
          </span>
        )}
        <h1 className="mt-4 font-display text-3xl md:text-5xl font-bold leading-tight">
          Naturanza Food Blog
        </h1>
        <p className="mt-3 max-w-2xl text-base sm:text-lg text-green-50/90">
          Insights on pure honey, ispaghol husk, and natural living — tips you can actually use.
        </p>
      </div>
    </section>
  );
}
