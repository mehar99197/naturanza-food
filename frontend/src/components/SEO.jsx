import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_URL, SITE_DOMAIN } from '@/config/site';
import { useOptionalSettings } from '@/context/SettingsContext';
import { CATEGORY_DESCRIPTION_DEFAULTS } from '@/lib/categoryDefaults';
import { getProductContentDefaults } from '@/lib/productContentDefaults';
import { extractTwitterHandle, getConfiguredSocialUrls } from '@/lib/socialLinks';
import { getProductPricing } from '@/lib/utils';

const SITE_NAME = 'Naturanza Food';
const DEFAULT_DESCRIPTION = 'Discover pure organic honey, ispaghol husk, organic spices, and natural wellness products. 100% natural, sustainably sourced, and delivered fresh to your door across Pakistan.';
const DEFAULT_KEYWORDS = 'organic food Pakistan, natural products, organic honey, ispaghol husk, organic spices, pure haldi, red chili powder, wellness, buy organic online Pakistan';

export function SEO({
  title,
  description,
  keywords = '',
  image = '/images/logo.png',
  type = 'website',
  url,
  author = 'Naturanza Food',
  price,
  currency = 'PKR',
  availability = 'in stock',
  noIndex = false,
  canonicalUrl,
}) {
  const { settings } = useOptionalSettings();
  const socialUrls = getConfiguredSocialUrls(settings);
  const twitterHandle = extractTwitterHandle(settings?.twitterUrl);
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Premium Organic & Natural Products in Pakistan`;
  const finalDescription = description || DEFAULT_DESCRIPTION;
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const canonical = canonicalUrl || currentUrl;
  const imageUrl = image.startsWith('http') ? image : `${typeof window !== 'undefined' ? window.location.origin : SITE_URL}${image}`;

  const robotsContent = noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const googlebotContent = noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
  const finalKeywords = keywords ? `${keywords}, ${DEFAULT_KEYWORDS}` : DEFAULT_KEYWORDS;

  // react-helmet-async v3 uses React 19 native <head> hoisting, which appends
  // live tags without removing static SSR tags shipped in index.html. Prune
  // the static SSR placeholders once live Helmet tags are mounted so <head>
  // never carries duplicate conflicting canonical/hreflang/meta tags.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.head) return;
    document.head
      .querySelectorAll('link[data-rh="true"], meta[data-rh="true"]')
      .forEach((node) => node.remove());
  }, [canonical]);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={finalDescription} />
      {finalKeywords && <meta name="keywords" content={finalKeywords} />}
      <meta name="author" content={author} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#22c55e" />
      <meta name="robots" content={robotsContent} />
      <meta name="googlebot" content={googlebotContent} />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />
      <meta name="geo.region" content="PK-PB" />
      <meta name="geo.placename" content="Nizam Pura, Chunian, District Kasur, Punjab, Pakistan" />

      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="en-pk" href={canonical} />
      <link rel="alternate" hrefLang="x-default" href={canonical} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={finalDescription} />
      {/* og:image varies per route, so a fixed 1200x630 hint was wrong on every
          product page. Omitted so scrapers measure the real file instead. */}
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_PK" />
      <meta property="og:locale:alternate" content="ur_PK" />
      {canonical && <meta property="og:url" content={canonical} />}
      {socialUrls.map((socialUrl) => (
        <meta key={socialUrl} property="og:see_also" content={socialUrl} />
      ))}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={fullTitle} />
      {twitterHandle && <meta name="twitter:site" content={twitterHandle} />}
      {twitterHandle && <meta name="twitter:creator" content={twitterHandle} />}
      <meta name="twitter:domain" content={SITE_DOMAIN} />

      {price && (
        <>
          <meta property="product:price:amount" content={price} />
          <meta property="product:price:currency" content={currency} />
          <meta property="product:availability" content={availability} />
        </>
      )}
    </Helmet>
  );
}

export function HomeSEO() {
  // No `title` prop on the home page → the SEO component uses the branded fallback
  // ("Naturanza Food - Premium Organic & Natural Products in Pakistan") instead of
  // appending a generic "Home", which Google was showing as "Naturanza Food: Home".
  return (
    <SEO
      description="Shop pure organic honey, ispaghol husk, organic spices, and natural wellness products. 100% natural, sustainably sourced. Free shipping on prepaid online orders over Rs. 5,000 across Pakistan."
      keywords="organic food Pakistan, natural products, buy organic honey, ispaghol husk online Pakistan, organic spices, pure turmeric haldi, red chili powder, organic store Karachi Lahore Islamabad"
      type="website"
      url={`${SITE_URL}/`}
    />
  );
}

export function ShopSEO({ category, categoryName }) {
  const categoryConfig = {
    honey: { title: 'Organic Honey', desc: CATEGORY_DESCRIPTION_DEFAULTS.honey, kw: 'organic honey Pakistan, raw honey online, pure honey buy, natural honey Pakistan' },
    ispaghol: { title: 'Ispaghol Husk', desc: CATEGORY_DESCRIPTION_DEFAULTS.ispaghol, kw: 'ispaghol husk Pakistan, psyllium husk online, natural fiber digestion Pakistan' },
    spices: { title: 'Organic Spices', desc: CATEGORY_DESCRIPTION_DEFAULTS.spices, kw: 'organic spices Pakistan, pure haldi online, red chili powder lal mirch Pakistan' },
    'herbal-teas': { title: 'Herbal Teas', desc: 'Premium herbal and green teas from trusted sources. Caffeine-free options for relaxation and detox.', kw: 'herbal tea Pakistan, green tea online, detox tea buy, natural tea store' },
    supplements: { title: 'Natural Supplements', desc: 'Boost your health naturally with our curated supplements. Free from artificial additives and preservatives.', kw: 'natural supplements Pakistan, organic supplements, health supplements online, vitamins Pakistan' },
    oils: { title: 'Natural Oils', desc: 'Cold-pressed natural oils for cooking and wellness. Including olive oil, coconut oil, and more.', kw: 'natural oils Pakistan, cold pressed oil online, organic cooking oil, coconut oil buy Pakistan' },
    seeds: { title: 'Organic Seeds', desc: 'Nutrient-rich organic seeds for supercharge your diet. Chia seeds, flaxseeds, pumpkin seeds and more.', kw: 'organic seeds Pakistan, chia seeds online, flax seeds buy, healthy seeds Pakistan' },
  };

  const normalizedSlug = String(category || '').trim().toLowerCase();
  const formattedFallbackTitle = categoryName
    ? String(categoryName).trim()
    : normalizedSlug
      ? normalizedSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Shop All Products';

  const config = normalizedSlug
    ? categoryConfig[normalizedSlug] || {
        title: formattedFallbackTitle,
        desc: `Browse our ${formattedFallbackTitle.toLowerCase()} collection at Naturanza Food. Premium quality, sustainably sourced across Pakistan.`,
        kw: `${formattedFallbackTitle.toLowerCase()} Pakistan, organic ${formattedFallbackTitle.toLowerCase()} online`,
      }
    : {
        title: 'Shop All Products',
        desc: 'Browse our complete range of organic and natural products. Premium quality, sustainably sourced across Pakistan.',
        kw: 'organic products Pakistan, natural food online, buy organic food',
      };

  return (
    <SEO
      title={config.title}
      description={config.desc}
      keywords={`${config.kw}, ${normalizedSlug || 'organic products'} online Pakistan`}
      type="website"
      url={`${SITE_URL}/shop${normalizedSlug ? `/${encodeURIComponent(normalizedSlug)}` : ''}`}
    />
  );
}

export function AboutSEO() {
  return (
    <SEO
      title="About Us"
      description="Discover Naturanza Food's story — Pakistan's trusted source for pure organic honey, ispaghol husk, organic spices, and natural wellness products. Learn about our quality standards, sourcing practices, and commitment to purity."
      keywords="about Naturanza Food, organic food brand Pakistan, natural products company, wellness brand Pakistan, organic store history"
      url={`${SITE_URL}/about`}
    />
  );
}

export function ContactSEO() {
  return (
    <SEO
      title="Contact Us"
      description="Contact Naturanza Food (Naturanza Foods) at Nizam Pura, Chunian, District Kasur, Punjab, Pakistan. Email: support@naturanzafood.com | Phone: +92340 9502646. Available 24/7 across Pakistan."
      keywords="contact Naturanza Food, organic food support Pakistan, natural products inquiry, bulk orders organic Pakistan, customer support"
      url={`${SITE_URL}/contact`}
    />
  );
}

export function FAQSEO() {
  return (
    <SEO
      title="Frequently Asked Questions"
      description="Find answers to common questions about Naturanza Food orders, delivery, returns, product sourcing, and certifications. Organic products support in Pakistan."
      keywords="Naturanza FAQ, organic products questions Pakistan, natural food FAQ, organic store help, honey delivery Pakistan"
      url={`${SITE_URL}/faq`}
    />
  );
}

export function ShippingSEO() {
  return (
    <SEO
      title="Shipping and Delivery"
      description="Naturanza Food shipping policy. Orders processed within 24 hours with 3–5 working days delivery across Pakistan and free shipping on prepaid online orders over Rs. 5,000."
      keywords="Naturanza shipping, organic delivery Pakistan, natural products shipping, COD delivery Pakistan, order tracking"
      url={`${SITE_URL}/shipping`}
    />
  );
}

export function ReturnsSEO() {
  return (
    <SEO
      title="Returns and Refunds Policy"
      description="Naturanza Food returns and refund policy. Request a return within 7 days of delivery for damaged, defective, or incorrect items. Approved refunds processed within 5–7 business days."
      keywords="Naturanza returns, organic products refund Pakistan, natural food returns, satisfaction guarantee Pakistan"
      url={`${SITE_URL}/returns`}
    />
  );
}

export function TermsSEO() {
  return (
    <SEO
      title="Terms of Service"
      description="Read Naturanza Food's Terms of Service. These terms govern your use of our website when purchasing organic and natural products in Pakistan."
      keywords="Naturanza terms of service, organic store terms Pakistan"
      url={`${SITE_URL}/terms`}
    />
  );
}

export function PrivacySEO() {
  return (
    <SEO
      title="Privacy Policy"
      description="Naturanza Food Privacy Policy. Learn how we collect, use, and protect your personal information when you shop organic products online in Pakistan."
      keywords="Naturanza privacy policy, organic store data protection Pakistan"
      url={`${SITE_URL}/privacy`}
    />
  );
}

export function CookiesSEO() {
  return (
    <SEO
      title="Cookie Policy"
      description="Naturanza Food Cookie Policy. Learn how we use cookies and similar technologies to improve your shopping experience for organic and natural products."
      keywords="Naturanza cookie policy, organic website cookies Pakistan"
      url={`${SITE_URL}/cookies`}
    />
  );
}

export function NoIndexSEO({ title }) {
  return (
    <SEO
      title={title}
      description=""
      noIndex={true}
    />
  );
}

export function ProductSEO({ product, category, settings }) {
  if (!product) return <SEO title="Product" />;
  const fullTitle = product.name;
  const fallbackDescription = getProductContentDefaults(product)?.description;
  const description =
    product.description ||
    fallbackDescription ||
    `${product.name} - Premium organic product from Naturanza Food. Order online with SafePay or Cash on Delivery across Pakistan.`;
  const productUrl = `${SITE_URL}/product/${product.id}`;
  const image = product.image_url || product.image || '/images/logo.png';
  const imageUrl = image.startsWith('http') ? image : `${SITE_URL}${image}`;
  const pricing = getProductPricing(product, settings);
  const effectivePrice = Number.isFinite(pricing.salePrice) && pricing.salePrice > 0
    ? pricing.salePrice.toFixed(2)
    : product.price;

  return (
    <SEO
      title={fullTitle}
      description={description}
      keywords={`${product.name}, organic ${category || 'product'} Pakistan, natural ${category || 'product'} online, buy ${product.name.toLowerCase()} Pakistan`}
      image={imageUrl}
      type="product"
      url={productUrl}
      price={effectivePrice}
      availability={
        (typeof product.is_in_stock === 'boolean'
          ? product.is_in_stock
          : Number(product.stock_quantity) > 0)
          ? 'in stock'
          : 'out of stock'
      }
    />
  );
}

export function PaginationSEO({ currentPage, totalPages, baseUrl }) {
  const canonical = currentPage === 1 ? baseUrl : `${baseUrl}?page=${currentPage}`;
  const nextPage = currentPage < totalPages ? `${baseUrl}?page=${currentPage + 1}` : null;
  const prevPage = currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}` : null;

  return (
    <>
      <SEO
        title={`Page ${currentPage}`}
        description={`Browse organic products page ${currentPage} of ${totalPages}. Premium quality, sustainably sourced products in Pakistan.`}
        url={canonical}
        canonicalUrl={baseUrl}
      />
      {(prevPage || nextPage) && (
        <Helmet>
          {prevPage && <link rel="prev" href={prevPage} />}
          {nextPage && <link rel="next" href={nextPage} />}
        </Helmet>
      )}
    </>
  );
}

export function BlogPostSEO({ title, description, url, date, author, image }) {
  const imageUrl = image ? (image.startsWith('http') ? image : `${SITE_URL}${image}`) : `${SITE_URL}/images/logo.png`;

  return (
    <>
      <SEO
        title={title}
        description={description}
        author={author || 'Naturanza Food'}
        type="article"
        url={url}
        image={imageUrl}
        keywords={`${title}, naturanza food blog, organic food Pakistan, health tips`}
      />
      {date && (
        <Helmet>
          <meta property="article:published_time" content={date} />
        </Helmet>
      )}
    </>
  );
}

export function SearchResultsSEO({ query, resultCount }) {
  const title = query ? `Search results for "${query}"` : 'Search Results';
  const description = resultCount > 0
    ? `Found ${resultCount} products matching "${query}". Shop premium organic products in Pakistan.`
    : `No results found for "${query}". Browse our complete range of organic products.`;

  return (
    <SEO
      title={title}
      description={description}
      noIndex={resultCount === 0}
    />
  );
}
