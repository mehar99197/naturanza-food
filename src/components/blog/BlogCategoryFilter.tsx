"use client";

// The one interactive part of the listing. It is a Client Component because the
// original filters in place — no navigation, no URL change — and because the
// card layout depends on the *filtered* list: `wide` applies to whichever card is
// first after filtering, so the grid cannot be pre-rendered per category.
//
// Everything above it (hero, featured band, JSON-LD) stays on the server. This
// component's own markup is still server-rendered into the HTML response, so
// every post link is in the document a crawler receives; what the browser adds
// is only the ~2 kB that makes the pills clickable.

import { useMemo, useState } from "react";

import { BlogPostCard } from "./BlogPostCard";
import type { BlogCardPost } from "./postFields";

const ALL = "all";

/**
 * Bucket for a post with no category.
 *
 * Blog.jsx counted these under "General" but filtered with
 * `p.category === selectedCategory`, so clicking the General pill compared a
 * null against the string and always came back empty. Both sides now normalise
 * through this constant, which is the smallest change that makes the pill do
 * what its own count says it will.
 */
const UNCATEGORISED = "General";

const categoryOf = (post: BlogCardPost): string => post.category || UNCATEGORISED;

const PILL_BASE = "rounded-full px-4 py-2 text-sm font-semibold transition-colors";
const PILL_ON = "bg-green-600 text-white shadow-sm";
const PILL_OFF = "border border-green-100 bg-white text-slate-600 hover:bg-green-50";

export function BlogCategoryFilter({ posts }: { posts: BlogCardPost[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      const name = categoryOf(post);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }, [posts]);

  const filteredPosts = useMemo(
    () =>
      selectedCategory === ALL
        ? posts
        : posts.filter((post) => categoryOf(post) === selectedCategory),
    [posts, selectedCategory],
  );

  return (
    <>
      {/* Category filter */}
      <section className="mt-12">
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setSelectedCategory(ALL)}
            className={`${PILL_BASE} ${selectedCategory === ALL ? PILL_ON : PILL_OFF}`}
          >
            All Posts ({posts.length})
          </button>
          {categories.map((category) => (
            <button
              key={category.name}
              onClick={() => setSelectedCategory(category.name)}
              className={`${PILL_BASE} ${
                selectedCategory === category.name ? PILL_ON : PILL_OFF
              }`}
            >
              {category.name} ({category.count})
            </button>
          ))}
        </div>
      </section>

      {/* All posts */}
      <section className="mt-7">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPosts.map((post, index) => (
            <BlogPostCard
              key={post.id}
              post={post}
              wide={index === 0 && filteredPosts.length >= 3}
            />
          ))}
        </div>
        {filteredPosts.length === 0 && (
          <p className="rounded-2xl border border-green-100 bg-white px-4 py-10 text-center text-slate-500">
            No articles in this category.
          </p>
        )}
      </section>
    </>
  );
}
