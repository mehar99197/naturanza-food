import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Loader2, ArrowLeft, Clock3, CalendarDays,
  Copy, Check, List, ChevronDown, ChevronUp, BookOpen,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SEO } from '@/components/SEO';
import { ArticleStructuredData } from '@/components/StructuredData';
import { blogAPI, newsletterAPI } from '@/services/api';
import { getAbsoluteImageUrl } from '@/lib/imageUtils';
import { SITE_URL } from '@/config/site';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toId = (children) =>
  [children].flat()
    .map((c) => (typeof c === 'string' ? c : ''))
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .trim()
    .replace(/\s+/g, '-');

const extractTOC = (md) => {
  if (!md) return [];
  return md
    .split('\n')
    .filter((l) => /^#{1,3} /.test(l))
    .map((l) => {
      const m = l.match(/^(#{1,3}) (.+)/);
      if (!m) return null;
      const text = m[2].trim();
      return {
        level: m[1].length,
        text,
        id: text.toLowerCase().replace(/[^a-z0-9\s]+/g, '').trim().replace(/\s+/g, '-'),
      };
    })
    .filter(Boolean);
};

// WhatsApp SVG icon (lucide doesn't include it)
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// ─── Markdown renderers ────────────────────────────────────────────────────────

const makeMarkdownComponents = () => ({
  h1: ({ children }) => (
    <h2 id={toId(children)} className="scroll-mt-24 text-2xl sm:text-3xl font-bold text-gray-900 mt-8 mb-4">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 id={toId(children)} className="scroll-mt-24 text-xl sm:text-2xl font-bold text-gray-900 mt-7 mb-3">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 id={toId(children)} className="scroll-mt-24 text-lg font-semibold text-gray-900 mt-5 mb-2">
      {children}
    </h4>
  ),
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
  code: ({ children }) => (
    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-gray-800">{children}</code>
  ),
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-green-50 text-gray-800">{children}</thead>,
  th: ({ children }) => (
    <th className="px-4 py-2.5 text-left font-semibold border-b border-gray-200">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 border-b border-gray-100 text-gray-700 align-top">{children}</td>
  ),
});

// ─── Newsletter CTA ────────────────────────────────────────────────────────────

function NewsletterCTA({ sourceTitle }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | success | error

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState('loading');
    try {
      await newsletterAPI.subscribe(email.trim(), `blog:${sourceTitle}`);
      setState('success');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-700 via-green-600 to-emerald-600 p-7 sm:p-9 text-white shadow-lg mb-8">
      <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-white/10 blur-xl" />
      <p className="text-xs font-bold uppercase tracking-widest text-green-200 mb-1">Naturanza Journal</p>
      <h3 className="text-xl sm:text-2xl font-bold mb-2">Get our next article in your inbox</h3>
      <p className="text-green-100/90 text-sm mb-5">
        Tips on natural food, traditional remedies, and healthy living — no spam, unsubscribe anytime.
      </p>
      {state === 'success' ? (
        <p className="flex items-center gap-2 font-semibold text-green-100">
          <Check className="h-5 w-5" /> You're subscribed — thank you!
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 rounded-xl bg-white/15 border border-white/20 px-4 py-2.5 text-sm text-white placeholder-white/50 backdrop-blur-sm outline-none focus:border-white/50 focus:bg-white/20"
          />
          <button
            type="submit"
            disabled={state === 'loading'}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-green-700 transition hover:bg-green-50 disabled:opacity-60"
          >
            {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Subscribe
          </button>
        </form>
      )}
      {state === 'error' && (
        <p className="mt-2 text-xs text-red-200">Something went wrong — please try again.</p>
      )}
    </div>
  );
}

// ─── TOC Sidebar ──────────────────────────────────────────────────────────────

function TOCSidebar({ items, activeId, onClickItem }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Table of contents">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3 pb-2 border-b border-slate-100">
        <List className="h-3.5 w-3.5 text-green-600" /> Contents
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: item.level > 2 ? '10px' : undefined }}>
            <button
              onClick={() => onClickItem(item.id)}
              className={`text-left w-full text-[13px] leading-snug py-1.5 px-2.5 rounded-lg transition-all ${
                activeId === item.id
                  ? 'bg-green-50 text-green-700 font-semibold border-l-2 border-green-500 pl-2'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ─── Mobile TOC accordion ─────────────────────────────────────────────────────

function MobileTOC({ items, activeId, onClickItem }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="lg:hidden mb-6 rounded-xl border border-green-100 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700"
      >
        <span className="flex items-center gap-2">
          <List className="h-4 w-4 text-green-600" /> Table of Contents
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-green-50 px-4 py-3">
          <TOCSidebar items={items} activeId={activeId} onClickItem={(id) => { onClickItem(id); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [readPct, setReadPct] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activeId, setActiveId] = useState('');
  const markdownComponents = useMemo(() => makeMarkdownComponents(), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setReadPct(0);
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
        } catch { /* optional */ }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const tocItems = useMemo(() => (post ? extractTOC(post.content) : []), [post]);

  // Reading progress + active TOC heading
  useEffect(() => {
    if (!post) return;
    let rafId;
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const el = document.documentElement;
        const pct = el.scrollHeight === el.clientHeight
          ? 0
          : (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
        setReadPct(Math.min(100, Math.max(0, pct)));

        if (tocItems.length) {
          let active = tocItems[0].id;
          for (const item of tocItems) {
            const node = document.getElementById(item.id);
            if (node && node.getBoundingClientRect().top <= 110) active = item.id;
          }
          setActiveId(active);
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(rafId); };
  }, [post, tocItems]);

  const scrollToHeading = useCallback((id) => {
    const node = document.getElementById(id);
    if (!node) return;
    const top = node.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, []);

  // ── Loading / error states ──────────────────────────────────────────────────

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
  const waText = encodeURIComponent(`${post.title} — ${articleUrl}`);
  const waUrl = `https://wa.me/?text=${waText}`;

  const hasTOC = tocItems.length > 0;

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

      {/* Reading progress bar */}
      <div
        className="fixed top-0 left-0 z-[70] h-[3px] bg-gradient-to-r from-emerald-400 to-green-600 transition-all duration-150 ease-out pointer-events-none"
        style={{ width: `${readPct}%` }}
        aria-hidden="true"
      />

      <div className="min-h-screen bg-[#faf8f3]">

        {/* ── Green header ───────────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 text-white pt-24 sm:pt-28 pb-14 sm:pb-16 overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          <div className="container-custom relative">
            {/* Back + share row */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Link
                to="/blog"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/25"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Blog
              </Link>
              {/* Share buttons */}
              <div className="flex items-center gap-2">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/25"
                  aria-label="Share on WhatsApp"
                >
                  <WhatsAppIcon /> WhatsApp
                </a>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/25"
                  aria-label="Copy link"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
            </div>

            {/* Title block */}
            <div className="mt-5 max-w-3xl">
              {post.category && (
                <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                  {post.category}
                </span>
              )}
              <h1 className="mt-3 font-display text-2xl sm:text-3xl md:text-[2.6rem] md:leading-tight font-bold">
                {post.title}
              </h1>
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/95">
                <span className="inline-flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/25 text-sm font-bold text-white ring-2 ring-white/40 shadow-sm">
                    {authorInitial}
                  </span>
                  <span className="font-medium">{post.author}</span>
                </span>
                <span className="text-white/40">·</span>
                <span className="inline-flex items-center gap-1.5 text-white/80">
                  <CalendarDays className="h-3.5 w-3.5" /> {post.date}
                </span>
                <span className="text-white/40">·</span>
                <span className="inline-flex items-center gap-1.5 text-white/80">
                  <Clock3 className="h-3.5 w-3.5" /> {post.readTime}
                </span>
                {readPct > 5 && readPct < 99 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white">
                    <BookOpen className="h-3.5 w-3.5" />
                    {Math.round(readPct)}% read
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Content area ───────────────────────────────────────────────── */}
        <div className="container-custom pb-14">
          <div className={hasTOC ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-10 lg:items-start' : 'max-w-3xl mx-auto'}>

            {/* ── Article column ─────────────────────────────────────────── */}
            <div>
              {/* Article card — overlaps header cleanly, image at top */}
              <article className="-mt-10 sm:-mt-12 bg-white rounded-2xl shadow-lg overflow-hidden mb-8 ring-1 ring-black/5">
                {coverImage && (
                  <img
                    src={coverImage}
                    alt={post.title}
                    className="w-full h-56 sm:h-[340px] object-cover"
                  />
                )}
                <div className="p-6 sm:p-9">
                  {/* Mobile TOC */}
                  <MobileTOC items={tocItems} activeId={activeId} onClickItem={scrollToHeading} />

                  {/* Excerpt */}
                  {post.excerpt && (
                    <p className="text-lg leading-relaxed text-slate-600 mb-7 pb-7 border-b border-gray-100">
                      {post.excerpt}
                    </p>
                  )}

                  {/* Main content */}
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {post.content}
                  </ReactMarkdown>
                </div>
              </article>

              {/* Author bio */}
              <div className="flex items-start gap-4 bg-white rounded-2xl border border-green-100 shadow-sm p-5 sm:p-6 mb-8">
                <div className="relative shrink-0">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 text-white text-2xl font-bold shadow-lg ring-4 ring-green-50">
                    {authorInitial}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 ring-2 ring-white">
                    <svg className="h-2.5 w-2.5 text-white fill-current" viewBox="0 0 12 12"><path d="M10.28 2.28L4 8.56 1.72 6.28A1 1 0 00.28 7.72l3 3a1 1 0 001.44 0l7-7a1 1 0 00-1.44-1.44z"/></svg>
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-base">{post.author}</p>
                  <p className="text-sm text-green-600 font-semibold mt-0.5">Naturanza Food · Writer</p>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    We write about natural food, traditional remedies, and healthy living for Pakistani families — practical, honest, and based on real experience.
                  </p>
                </div>
              </div>

              {/* Newsletter CTA */}
              <NewsletterCTA sourceTitle={post.title} />

              {/* Related articles */}
              {related.length > 0 && (
                <div className="mb-8">
                  <h3 className="mb-5 text-xl font-bold text-[#2d3a2d]">Related Articles</h3>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    {related.map((rp) => (
                      <Link
                        key={rp.id}
                        to={`/blog/${rp.slug}`}
                        className="group flex overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <div className="w-28 shrink-0 overflow-hidden">
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
                        <div className="flex flex-col justify-center p-4 min-w-0">
                          <span className="text-[11px] font-bold uppercase tracking-wide text-green-600">{rp.category}</span>
                          <h4 className="mt-1 text-sm font-semibold text-slate-800 transition-colors group-hover:text-green-700 line-clamp-2">
                            {rp.title}
                          </h4>
                          {rp.excerpt && (
                            <p className="mt-1 text-xs text-slate-500 line-clamp-2">{rp.excerpt}</p>
                          )}
                          <span className="mt-2 text-xs text-slate-400">{rp.readTime}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Shop CTA */}
              <div className="rounded-2xl border border-green-100 bg-white p-8 text-center shadow-sm">
                <span className="text-3xl mb-3 block">🌿</span>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Ready to try natural products?</h3>
                <p className="text-gray-500 mb-5 text-sm">
                  Pure mountain honey and natural ispaghol husk — directly from trusted farms.
                </p>
                <Link
                  to="/shop"
                  className="inline-block bg-gradient-to-r from-emerald-500 to-green-600 text-white px-7 py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-green-700 transition-all shadow-md shadow-green-500/20"
                >
                  Shop Now
                </Link>
              </div>
            </div>

            {/* ── TOC Sidebar (desktop only) ─────────────────────────────── */}
            {hasTOC && (
              <aside className="hidden lg:block">
                <div className="sticky top-28 space-y-6">
                  {/* TOC */}
                  <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                    <TOCSidebar items={tocItems} activeId={activeId} onClickItem={scrollToHeading} />
                  </div>

                  {/* Sidebar share */}
                  <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Share</p>
                    <div className="flex flex-col gap-2">
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-100"
                      >
                        <WhatsAppIcon /> Share on WhatsApp
                      </a>
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Link copied!' : 'Copy link'}
                      </button>
                    </div>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default BlogPost;
