import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Clock3, CalendarDays } from 'lucide-react';
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
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f3]">
        <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f3]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Post Not Found</h1>
          <Link to="/blog" className="text-green-600 hover:underline">Back to Blog</Link>
        </div>
      </div>
    );
  }

  const articleUrl = `${SITE_URL}/blog/${post.slug}`;
  const coverImage = post.image ? getAbsoluteImageUrl(post.image, { defaultFolder: 'blog' }) : null;
  const authorInitial = (String(post.author || 'N').trim().charAt(0) || 'N').toUpperCase();

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

      <div className="min-h-screen bg-[#faf8f3]">
        {/* Header — pt clears the fixed navbar */}
        <div className="bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 text-white pt-24 sm:pt-28 pb-16 sm:pb-24">
          <div className="container-custom">
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/25 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Blog
            </Link>
            <div className="mt-5 max-w-3xl">
              {post.category && (
                <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                  {post.category}
                </span>
              )}
              <h1 className="mt-3 font-display text-2xl sm:text-3xl md:text-[2.6rem] md:leading-tight font-bold">
                {post.title}
              </h1>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-green-50/90">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                    {authorInitial}
                  </span>
                  By {post.author}
                </span>
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" /> {post.date}</span>
                <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" /> {post.readTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container-custom pb-12">
          <div className="max-w-3xl mx-auto">
            {/* Cover image (or the article card) overlaps the header for a magazine feel */}
            {coverImage && (
              <img
                src={coverImage}
                alt={post.title}
                className="-mt-12 sm:-mt-20 w-full h-52 sm:h-80 object-cover rounded-2xl shadow-xl ring-4 ring-[#faf8f3]"
              />
            )}

            <article
              className={`bg-white rounded-2xl p-6 sm:p-9 shadow-sm mb-8 ${
                coverImage ? 'mt-8' : '-mt-8 sm:-mt-12'
              }`}
            >
              {post.excerpt && (
                <p className="text-lg leading-relaxed text-slate-600 mb-7 pb-7 border-b border-gray-100">
                  {post.excerpt}
                </p>
              )}
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {post.content}
              </ReactMarkdown>
            </article>

            {/* Related */}
            {related.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-5 text-xl font-bold text-[#2d3a2d]">Related Articles</h3>
                <div className="grid gap-5 sm:grid-cols-3">
                  {related.map((rp) => (
                    <Link
                      key={rp.id}
                      to={`/blog/${rp.slug}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="h-28 overflow-hidden">
                        {rp.image ? (
                          <img
                            src={getAbsoluteImageUrl(rp.image, { defaultFolder: 'blog' })}
                            alt={rp.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-green-100 to-emerald-50">
                            <span className="text-2xl">🌿</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-green-600">{rp.category}</span>
                        <h4 className="mt-1 flex-1 font-semibold text-slate-800 transition-colors group-hover:text-green-700 line-clamp-2">
                          {rp.title}
                        </h4>
                        <span className="mt-2 text-xs text-slate-500">{rp.readTime}</span>
                      </div>
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
