import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Newspaper } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { BlogStructuredData } from '@/components/StructuredData';
import { blogAPI } from '@/services/api';
import { getAbsoluteImageUrl } from '@/lib/imageUtils';
import { SITE_URL } from '@/config/site';

const CoverImage = ({ post, className, fallbackEmoji = '📝', emojiClass = 'text-4xl' }) => {
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
      <span className={emojiClass}>{fallbackEmoji}</span>
    </div>
  );
};

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
  const recentPosts = useMemo(
    () => [...posts].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3),
    [posts],
  );
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

      <div className="min-h-screen bg-stone-50">
        {/* Hero */}
        <div className="bg-gradient-to-r from-green-700 to-emerald-600 text-white py-14 sm:py-16">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl md:text-5xl font-bold mb-3">Naturanza Food Blog</h1>
            <p className="text-base sm:text-xl opacity-90 max-w-2xl">
              Insights on pure honey, ispaghol husk, and natural living — tips you can actually use.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-10 sm:py-12">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 max-w-xl">{error}</div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-green-100 bg-white p-12 text-center text-slate-500">
              <Newspaper className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700">No articles yet</p>
              <p className="text-sm mt-1">Check back soon for tips and guides.</p>
            </div>
          ) : (
            <>
              {/* Featured */}
              {featuredPosts.length > 0 && (
                <section className="mb-14">
                  <h2 className="text-2xl font-bold text-gray-800 mb-6">Featured Articles</h2>
                  <div className="grid md:grid-cols-2 gap-8">
                    {featuredPosts.map((post) => (
                      <Link
                        key={post.id}
                        to={`/blog/${post.slug}`}
                        className="group block bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow"
                      >
                        <CoverImage post={post} className="h-56 w-full" fallbackEmoji="🍯" emojiClass="text-6xl" />
                        <div className="p-6">
                          <span className="text-green-600 text-sm font-semibold">{post.category}</span>
                          <h3 className="text-xl font-bold mt-2 group-hover:text-green-600 transition-colors">
                            {post.title}
                          </h3>
                          <p className="text-gray-600 mt-2 line-clamp-2">{post.excerpt}</p>
                          <div className="flex items-center mt-4 text-gray-500 text-sm">
                            <span>{post.readTime}</span>
                            <span className="mx-2">•</span>
                            <span>{post.date}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Category filter */}
              <section className="mb-10">
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-green-50 border border-gray-200'
                    }`}
                  >
                    All Posts ({posts.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        selectedCategory === cat.name
                          ? 'bg-green-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-green-50 border border-gray-200'
                      }`}
                    >
                      {cat.name} ({cat.count})
                    </button>
                  ))}
                </div>
              </section>

              {/* All posts */}
              <section className="mb-14">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">All Articles</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
                  {filteredPosts.map((post) => (
                    <Link
                      key={post.id}
                      to={`/blog/${post.slug}`}
                      className="group block bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                    >
                      <CoverImage post={post} className="h-44 w-full" />
                      <div className="p-5">
                        <span className="text-green-600 text-xs font-semibold">{post.category}</span>
                        <h3 className="text-lg font-bold mt-2 group-hover:text-green-600 transition-colors line-clamp-2">
                          {post.title}
                        </h3>
                        <p className="text-gray-600 text-sm mt-2 line-clamp-2">{post.excerpt}</p>
                        <div className="flex items-center mt-3 text-gray-500 text-xs">
                          <span>{post.readTime}</span>
                          <span className="mx-2">•</span>
                          <span>{post.date}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* Recent */}
              {recentPosts.length > 0 && (
                <section className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Posts</h3>
                  <div className="space-y-3.5">
                    {recentPosts.map((post) => (
                      <Link key={post.id} to={`/blog/${post.slug}`} className="block group">
                        <h4 className="font-medium text-gray-800 group-hover:text-green-600 transition-colors">
                          {post.title}
                        </h4>
                        <span className="text-gray-500 text-sm">{post.date}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default Blog;
