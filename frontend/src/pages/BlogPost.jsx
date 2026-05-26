import { useParams, Link } from 'react-router-dom';
import { SEO } from '@/components/SEO';
import { ArticleStructuredData } from '@/components/StructuredData';
import { getBlogPostBySlug, getRecentPosts } from '@/data/blogPosts';
import { SITE_URL } from '@/config/site';

export function BlogPost() {
  const { slug } = useParams();
  const post = getBlogPostBySlug(slug);
  const recentPosts = getRecentPosts(3).filter(p => p.slug !== slug);

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Post Not Found</h1>
          <Link to="/blog" className="text-green-600 hover:underline">
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  const articleUrl = `${SITE_URL}/blog/${post.slug}`;

  return (
    <>
      <SEO
        title={post.title}
        description={post.excerpt}
        keywords={post.keywords}
        url={articleUrl}
        image={post.image}
        type="article"
      />
      <ArticleStructuredData
        title={post.title}
        description={post.excerpt}
        url={articleUrl}
        author={post.author}
        datePublished={post.date}
        image={post.image}
      />

      <div className="min-h-screen bg-stone-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 text-white py-16">
          <div className="container mx-auto px-4">
            <Link
              to="/blog"
              className="inline-flex items-center text-white/80 hover:text-white mb-4"
            >
              ← Back to Blog
            </Link>
            <span className="inline-block bg-white/20 text-white px-3 py-1 rounded-full text-sm mb-4">
              {post.category}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold">{post.title}</h1>
            <div className="flex items-center mt-4 text-white/80">
              <span>By {post.author}</span>
              <span className="mx-3">•</span>
              <span>{post.date}</span>
              <span className="mx-3">•</span>
              <span>{post.readTime}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl p-8 shadow-sm mb-8">
              <p className="text-xl text-gray-600 leading-relaxed mb-8">{post.excerpt}</p>
              <div className="prose prose-green max-w-none">
                {post.content.split('\n').map((line, i) => {
                  // Article title is already rendered as <h1> above, so demote markdown
                  // `# ` to <h2> and chain down to keep a single-h1, valid hierarchy.
                  if (line.startsWith('# ')) {
                    return <h2 key={i} className="text-3xl font-bold mt-8 mb-4">{line.slice(2)}</h2>;
                  }
                  if (line.startsWith('## ')) {
                    return <h3 key={i} className="text-2xl font-bold mt-6 mb-3">{line.slice(3)}</h3>;
                  }
                  if (line.startsWith('### ')) {
                    return <h4 key={i} className="text-xl font-semibold mt-4 mb-2">{line.slice(4)}</h4>;
                  }
                  if (line.startsWith('- ')) {
                    return <li key={i} className="ml-4 mb-1">{line.slice(2)}</li>;
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={i} className="font-bold mt-4">{line.replace(/\*\*/g, '')}</p>;
                  }
                  if (line.trim() === '') {
                    return <br key={i} />;
                  }
                  return <p key={i} className="mb-4 leading-relaxed">{line}</p>;
                })}
              </div>
            </div>

            {/* Related Posts */}
            {recentPosts.length > 0 && (
              <div className="bg-white rounded-xl p-8 shadow-sm">
                <h3 className="text-xl font-bold text-gray-800 mb-6">Related Articles</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  {recentPosts.map(relatedPost => (
                    <Link
                      key={relatedPost.id}
                      to={`/blog/${relatedPost.slug}`}
                      className="group"
                    >
                      <div className="h-32 bg-green-50 rounded-lg mb-3 flex items-center justify-center">
                        <span className="text-3xl">📄</span>
                      </div>
                      <h4 className="font-medium text-gray-800 group-hover:text-green-600 transition-colors line-clamp-2">
                        {relatedPost.title}
                      </h4>
                      <span className="text-gray-500 text-sm">{relatedPost.readTime}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="bg-green-50 rounded-xl p-8 mt-8 text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Ready to try organic products?</h3>
              <p className="text-gray-600 mb-4">Shop our premium organic honey, herbal teas, and natural supplements.</p>
              <Link
                to="/shop"
                className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Shop Now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default BlogPost;