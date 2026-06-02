import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, Clock3, CalendarDays } from 'lucide-react';
import { LeafLoader } from '@/components/Loader';
import { SEO } from '@/components/SEO';
import { BlogStructuredData } from '@/components/StructuredData';
import { blogAPI } from '@/services/api';
import { getAbsoluteImageUrl } from '@/lib/imageUtils';
import { SITE_URL } from '@/config/site';

const CoverImage = ({ post, className, emojiClass = 'text-4xl' }) => {
  if (post.image) {
    return (
      <img
        src={getAbsoluteImageUrl(post.image, { defaultFolder: 'blog' })}
        alt={post.title}
        loading="lazy"
        className={`${className} object-cover`}
      />
    );
  }
  return (
    <div className={`${className} bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center`}>
      <span className={emojiClass}>🌿</span>
    </div>
  );
};

const MetaRow = ({ post, className = '' }) => (
  <div className={`flex items-center gap-3 text-[13px] text-slate-500 ${className}`}>
    <span className="inline-flex items-center gap-1">
      <Clock3 className="h-3.5 w-3.5" /> {post.readTime || '—'}
    </span>
    <span className="inline-flex items-center gap-1">
      <CalendarDays className="h-3.5 w-3.5" /> {post.date}
    </span>
  </div>
);

export function Blog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const rows = await blogAPI.getPosts();
        if (!cancelled) setPosts(Array.isArray(rows) ? rows : []);
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.error || 'Failed to load articles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => {
    const map = new Map();
    posts.forEach((p) => {
      const name = p.category || 'General';
      map.set(name, (map.get(name) || 0) + 1);
    });
    return [...map.entries()].map(([name, count]) => ({ name, count }));
  }, [posts]);

  const featuredPosts = useMemo(() => posts.filter((p) => p.featured), [posts]);
  const filteredPosts = useMemo(
    () => (selectedCategory === 'all' ? posts : posts.filter((p) => p.category === selectedCategory)),
    [posts, selectedCategory],
  );

  return (
    <>
      <SEO
        title="Blog"
        description="Expert articles on pure honey, ispaghol husk, digestive health, and natural living from Naturanza Food — Pakistan's trusted organic store."
        keywords="organic food blog Pakistan, honey benefits, ispaghol husk, digestive health, natural products"
        url={`${SITE_URL}/blog`}
      />
      <BlogStructuredData posts={posts} />

      <main className="pt-20 sm:pt-24 pb-14 min-h-screen bg-[#faf8f3]">
        <div className="container-custom">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 px-6 py-10 sm:px-10 sm:py-14 text-white shadow-[0_18px_48px_rgba(7,43,24,0.18)]">
            <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-8 left-1/3 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
            {/* Subtle dot grid */}
            <div className="pointer-events-none absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize:'28px 28px'}} />
            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                <Newspaper className="h-3.5 w-3.5" /> Naturanza Journal
              </span>
              {posts.length > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                  {posts.length} {posts.length === 1 ? 'Article' : 'Articles'}
                </span>
              )}
              <h1 className="mt-4 font-display text-3xl md:text-5xl font-bold leading-tight">Naturanza Food Blog</h1>
              <p className="mt-3 max-w-2xl text-base sm:text-lg text-green-50/90">
                Insights on pure honey, ispaghol husk, and natural living — tips you can actually use.
              </p>
            </div>
          </section>

          {loading ? (
            <LeafLoader label="Loading articles..." />
          ) : error ? (
            <div className="mt-8 max-w-xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
          ) : posts.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-green-100 bg-white p-12 text-center text-slate-500">
              <Newspaper className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="font-semibold text-slate-700">No articles yet</p>
              <p className="mt-1 text-sm">Check back soon for tips and guides.</p>
            </div>
          ) : (
            <>
              {/* Featured */}
              {featuredPosts.length > 0 && (
                <section className="mt-10 sm:mt-12">
                  <h2 className="mb-5 text-xl sm:text-2xl font-bold text-[#2d3a2d]">Featured Articles</h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    {featuredPosts.map((post) => (
                      <Link
                        key={post.id}
                        to={`/blog/${post.slug}`}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <CoverImage post={post} className="h-52 w-full" emojiClass="text-6xl" />
                        <div className="flex flex-1 flex-col p-5 sm:p-6">
                          <span className="text-xs font-bold uppercase tracking-wide text-green-600">{post.category}</span>
                          <h3 className="mt-2 text-lg sm:text-xl font-bold text-slate-900 transition-colors group-hover:text-green-700 line-clamp-2">
                            {post.title}
                          </h3>
                          <p className="mt-2 flex-1 text-sm text-slate-600 line-clamp-2">{post.excerpt}</p>
                          <MetaRow post={post} className="mt-4" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Category filter */}
              <section className="mt-12">
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-green-600 text-white shadow-sm'
                        : 'border border-green-100 bg-white text-slate-600 hover:bg-green-50'
                    }`}
                  >
                    All Posts ({posts.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        selectedCategory === cat.name
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'border border-green-100 bg-white text-slate-600 hover:bg-green-50'
                      }`}
                    >
                      {cat.name} ({cat.count})
                    </button>
                  ))}
                </div>
              </section>

              {/* All posts */}
              <section className="mt-7">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPosts.map((post, idx) => (
                    <Link
                      key={post.id}
                      to={`/blog/${post.slug}`}
                      className={`group flex flex-col overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:border-green-200 ${
                        idx === 0 && filteredPosts.length >= 3 ? 'sm:col-span-2 lg:col-span-1' : ''
                      }`}
                    >
                      <div className="overflow-hidden">
                        <CoverImage
                          post={post}
                          className={`w-full transition-transform duration-500 group-hover:scale-105 ${
                            idx === 0 && filteredPosts.length >= 3 ? 'h-52 sm:h-64 lg:h-44' : 'h-44'
                          }`}
                        />
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-green-600">{post.category}</span>
                        <h3 className="mt-1.5 text-base font-bold text-slate-900 transition-colors group-hover:text-green-700 line-clamp-2">
                          {post.title}
                        </h3>
                        <p className="mt-2 flex-1 text-sm text-slate-500 line-clamp-2">{post.excerpt}</p>
                        <div className="mt-4 flex items-center justify-between">
                          <MetaRow post={post} />
                          <span className="text-xs font-semibold text-green-600 opacity-0 group-hover:opacity-100 transition-opacity">
                            Read →
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                {filteredPosts.length === 0 && (
                  <p className="rounded-2xl border border-green-100 bg-white px-4 py-10 text-center text-slate-500">
                    No articles in this category.
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}

export default Blog;
