import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import { BlogStructuredData } from '@/components/StructuredData';
import { blogPosts, blogCategories, getFeaturedPosts, getRecentPosts } from '@/data/blogPosts';
import { SITE_URL } from '@/config/site';

export function Blog() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredPosts = selectedCategory === 'all'
    ? blogPosts
    : blogPosts.filter(post => post.category.toLowerCase() === selectedCategory.toLowerCase());

  const featuredPosts = getFeaturedPosts();
  const recentPosts = getRecentPosts(3);

  return (
    <>
      <SEO
        title="Blog"
        description="Read expert articles about organic honey, herbal teas, natural supplements, and health tips from Naturanza Food - Pakistan's trusted organic store."
        keywords="organic food blog Pakistan, health tips, honey benefits, herbal tea guide, natural supplements"
        url={`${SITE_URL}/blog`}
      />
      <BlogStructuredData posts={blogPosts} />

      <div className="min-h-screen bg-stone-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 text-white py-16">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Naturanza Food Blog</h1>
            <p className="text-xl opacity-90 max-w-2xl">
              Expert insights on organic living, health tips, and everything you need to know about natural products in Pakistan.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12">
          {/* Featured Posts */}
          {featuredPosts.length > 0 && (
            <section className="mb-16">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Featured Articles</h2>
              <div className="grid md:grid-cols-2 gap-8">
                {featuredPosts.map(post => (
                  <Link
                    key={post.id}
                    to={`/blog/${post.slug}`}
                    className="group block bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow"
                  >
                    <div className="h-64 bg-green-100 flex items-center justify-center">
                      <span className="text-6xl">🍯</span>
                    </div>
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

          {/* Category Filter */}
          <section className="mb-12">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-5 py-2 rounded-full font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-green-50 border'
                }`}
              >
                All Posts
              </button>
              {blogCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.slug)}
                  className={`px-5 py-2 rounded-full font-medium transition-colors ${
                    selectedCategory === cat.slug
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-green-50 border'
                  }`}
                >
                  {cat.name} ({cat.count || blogPosts.filter(p => p.category.toLowerCase() === cat.slug).length})
                </button>
              ))}
            </div>
          </section>

          {/* All Posts Grid */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">All Articles</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {filteredPosts.map(post => (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="group block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
                >
                  <div className="h-48 bg-green-50 flex items-center justify-center">
                    <span className="text-4xl">📝</span>
                  </div>
                  <div className="p-5">
                    <span className="text-green-600 text-xs font-semibold">{post.category}</span>
                    <h3 className="text-lg font-bold mt-2 group-hover:text-green-600 transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-gray-600 text-sm mt-2 line-clamp-2">{post.excerpt}</p>
                    <div className="flex items-center mt-3 text-gray-500 text-xs">
                      <span>{post.readTime}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent Posts Sidebar */}
          <section className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Posts</h3>
            <div className="space-y-4">
              {recentPosts.map(post => (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="block group"
                >
                  <h4 className="font-medium text-gray-800 group-hover:text-green-600 transition-colors">
                    {post.title}
                  </h4>
                  <span className="text-gray-500 text-sm">{post.date}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export default Blog;