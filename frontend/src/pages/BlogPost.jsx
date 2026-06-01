import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SEO } from '@/components/SEO';
import { ArticleStructuredData } from '@/components/StructuredData';
import { blogAPI } from '@/services/api';
import { getAbsoluteImageUrl } from '@/lib/imageUtils';
import { SITE_URL } from '@/config/site';

// Styled renderers so markdown (headings, lists, tables, links, bold) looks good
// without depending on a typography plugin. The article <h1> is in the header,
// so markdown `#` is demoted to <h2> to keep a single, valid heading hierarchy.
const markdownComponents = {
  h1: ({ children }) => <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-8 mb-4">{children}</h2>,
  h2: ({ children }) => <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-7 mb-3">{children}</h3>,
  h3: ({ children }) => <h4 className="text-lg font-semibold text-gray-900 mt-5 mb-2">{children}</h4>,
  p: ({ children }) => <p className="text-[15px] leading-7 text-gray-700 mb-4">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1.5 text-gray-700">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1.5 text-gray-700">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <Link to={href || '#'} className="text-green-700 font-semibold underline underline-offset-2 hover:text-green-800">
      {children}
    </Link>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-green-400 bg-green-50/60 px-4 py-2 my-4 rounded-r-lg text-gray-700 italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-gray-200" />,
  code: ({ children }) => <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-gray-800">{children}</code>,
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-green-50 text-gray-800">{children}</thead>,
  th: ({ children }) => <th className="px-4 py-2.5 text-left font-semibold border-b border-gray-200">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2.5 border-b border-gray-100 text-gray-700 align-top">{children}</td>,
};

export function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const data = await blogAPI.getPostBySlug(slug);
        if (cancelled) return;
        setPost(data);
        try {
          const all = await blogAPI.getPosts();
          if (!cancelled) {
            setRelated(
              (Array.isArray(all) ? all : [])
                .filter((p) => p.slug !== slug)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 3),
            );
          }
        } catch {
          /* related posts are optional */
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Post Not Found</h1>
          <Link to="/blog" className="text-green-600 hover:underline">Back to Blog</Link>
        </div>
      </div>
    );
  }

  const articleUrl = `${SITE_URL}/blog/${post.slug}`;
  const coverImage = post.image ? getAbsoluteImageUrl(post.image, { defaultFolder: 'blog' }) : null;

  return (
    <>
      <SEO
        title={post.title}
        description={post.excerpt}
        keywords={post.keywords}
        url={articleUrl}
        image={post.image || undefined}
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
        <div className="bg-gradient-to-r from-green-700 to-emerald-600 text-white py-12 sm:py-16">
          <div className="container mx-auto px-4">
            <Link to="/blog" className="inline-flex items-center text-white/80 hover:text-white mb-4">
              ← Back to Blog
            </Link>
            {post.category && (
              <span className="inline-block bg-white/20 text-white px-3 py-1 rounded-full text-sm mb-4">
                {post.category}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold max-w-3xl">{post.title}</h1>
            <div className="flex flex-wrap items-center mt-4 text-white/80 text-sm gap-x-3 gap-y-1">
              <span>By {post.author}</span>
              <span>•</span>
              <span>{post.date}</span>
              <span>•</span>
              <span>{post.readTime}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-10 sm:py-12">
          <div className="max-w-3xl mx-auto">
            {coverImage && (
              <img
                src={coverImage}
                alt={post.title}
                className="w-full h-56 sm:h-72 object-cover rounded-2xl shadow-sm mb-8"
              />
            )}

            <article className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm mb-8">
              {post.excerpt && (
                <p className="text-lg text-gray-600 leading-relaxed mb-6 pb-6 border-b border-gray-100">
                  {post.excerpt}
                </p>
              )}
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {post.content}
              </ReactMarkdown>
            </article>

            {/* Related */}
            {related.length > 0 && (
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm">
                <h3 className="text-xl font-bold text-gray-800 mb-6">Related Articles</h3>
                <div className="grid sm:grid-cols-3 gap-6">
                  {related.map((rp) => (
                    <Link key={rp.id} to={`/blog/${rp.slug}`} className="group">
                      <div className="h-28 rounded-lg mb-3 overflow-hidden">
                        {rp.image ? (
                          <img
                            src={getAbsoluteImageUrl(rp.image, { defaultFolder: 'blog' })}
                            alt={rp.title}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-green-100 to-emerald-50 flex items-center justify-center">
                            <span className="text-2xl">📄</span>
                          </div>
                        )}
                      </div>
                      <h4 className="font-medium text-gray-800 group-hover:text-green-600 transition-colors line-clamp-2">
                        {rp.title}
                      </h4>
                      <span className="text-gray-500 text-sm">{rp.readTime}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="bg-green-50 rounded-2xl p-8 mt-8 text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Ready to try natural products?</h3>
              <p className="text-gray-600 mb-4">Shop our pure mountain honey and natural ispaghol husk.</p>
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
