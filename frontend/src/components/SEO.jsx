import { Helmet } from 'react-helmet-async';
import { SITE_URL, SITE_DOMAIN } from '@/config/site';

const SITE_NAME = 'Naturanza Food';
const DEFAULT_DESCRIPTION = 'Discover premium organic honey, herbal teas, natural supplements, and wellness products. 100% natural, sustainably sourced, and delivered fresh to your door across Pakistan.';
const DEFAULT_KEYWORDS = 'organic food Pakistan, natural products, organic honey, herbal tea, supplements, wellness, buy organic online Pakistan';

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
  structuredData,
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - Premium Organic & Natural Products in Pakistan`;
  const finalDescription = description || DEFAULT_DESCRIPTION;
  const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const canonical = canonicalUrl || currentUrl;
  const imageUrl = image.startsWith('http') ? image : `${typeof window !== 'undefined' ? window.location.origin : SITE_URL}${image}`;

  const robotsContent = noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const googlebotContent = noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
  const finalKeywords = keywords ? `${keywords}, ${DEFAULT_KEYWORDS}` : DEFAULT_KEYWORDS;

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
      <meta name="geo.region" content="PK" />
      <meta name="geo.placename" content="Pakistan" />

      <link rel="canonical" href={canonical} />
      <link rel="alternate" hrefLang="en-pk" href={canonical} />
      <link rel="alternate" hrefLang="x-default" href={canonical} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_PK" />
      <meta property="og:locale:alternate" content="ur_PK" />
      {canonical && <meta property="og:url" content={canonical} />}
      <meta property="og:see_also" content="https://www.facebook.com/naturanzafood" />
      <meta property="og:see_also" content="https://www.instagram.com/naturanzafood" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={fullTitle} />
      <meta name="twitter:site" content="@naturanzafood" />
      <meta name="twitter:creator" content="@naturanzafood" />
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
  return (
    <SEO
      title="Home"
      description="Shop premium organic honey, herbal teas, natural supplements, and wellness products. 100% natural, sustainably sourced. Free shipping on orders over Rs. 2000 across Pakistan."
      keywords="organic food Pakistan, natural products, buy organic honey, herbal tea online Pakistan, natural supplements, organic store Karachi Lahore Islamabad"
      type="website"
      url={`${SITE_URL}/`}
    />
  );
}

export function ShopSEO({ category }) {
  const categoryConfig = {
    honey: { title: 'Organic Honey', desc: 'Pure, raw organic honey sourced from Pakistani beekeepers. 100% natural, unprocessed honey for health and wellness.', kw: 'organic honey Pakistan, raw honey online, pure honey buy, natural honey Karachi Lahore' },
    'herbal-teas': { title: 'Herbal Teas', desc: 'Premium herbal and green teas from trusted sources. Caffeine-free options for relaxation and detox.', kw: 'herbal tea Pakistan, green tea online, detox tea buy, natural tea store' },
    supplements: { title: 'Natural Supplements', desc: 'Boost your health naturally with our curated supplements. Free from artificial additives and preservatives.', kw: 'natural supplements Pakistan, organic supplements, health supplements online, vitamins Pakistan' },
    oils: { title: 'Natural Oils', desc: 'Cold-pressed natural oils for cooking and wellness. Including olive oil, coconut oil, and more.', kw: 'natural oils Pakistan, cold pressed oil online, organic cooking oil, coconut oil buy Pakistan' },
    seeds: { title: 'Organic Seeds', desc: 'Nutrient-rich organic seeds for supercharge your diet. Chia seeds, flaxseeds, pumpkin seeds and more.', kw: 'organic seeds Pakistan, chia seeds online, flax seeds buy, healthy seeds Pakistan' },
  };

  const config = category ? (categoryConfig[category] || { title: 'Shop', desc: 'Browse our complete range of organic and natural products.', kw: '' }) : { title: 'Shop All Products', desc: 'Browse our complete range of organic and natural products. Premium quality, sustainably sourced across Pakistan.', kw: 'organic products Pakistan, natural food online, buy organic food' };

  return (
    <SEO
      title={config.title}
      description={config.desc}
      keywords={`${config.kw}, ${category || 'organic products'} online Pakistan`}
      type="website"
      url={`${SITE_URL}/shop${category ? `/${category}` : ''}`}
    />
  );
}

export function AboutSEO() {
  return (
    <SEO
      title="About Us"
      description="Discover Naturanza Food's story. Since 2010, we've been Pakistan's trusted source for organic honey, herbal teas, and natural wellness products. Learn about our quality standards, sourcing practices, and commitment to purity."
      keywords="about Naturanza Food, organic food brand Pakistan, natural products company, wellness brand Pakistan, organic store history"
      url={`${SITE_URL}/about`}
    />
  );
}

export function ContactSEO() {
  return (
    <SEO
      title="Contact Us"
      description="Contact Naturanza Food for orders, support, and bulk inquiries. Email: support@naturanzafood.com | Phone: +92 340 9502646. Available 24/7 for customer support across Pakistan."
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
      description="Naturanza Food shipping info. Orders processed within 24 hours. Standard delivery 2-5 business days in Pakistan. Cash on Delivery available nationwide."
      keywords="Naturanza shipping, organic delivery Pakistan, natural products shipping, COD delivery Pakistan, order tracking"
      url={`${SITE_URL}/shipping`}
    />
  );
}

export function ReturnsSEO() {
  return (
    <SEO
      title="Returns and Refunds Policy"
      description="Naturanza Food returns policy. Request return within 7 days. Refund processed within 5-10 business days after quality check. Quality guaranteed."
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

export function ProductSEO({ product, category }) {
  if (!product) return <SEO title="Product" />;
  const fullTitle = product.name;
  const description = product.description || `${product.name} - Premium organic product from Naturanza Food. Order online with Cash on Delivery across Pakistan.`;
  const productUrl = `${SITE_URL}/product/${product.id}`;
  const image = product.image_url || product.image || '/images/logo.png';
  const imageUrl = image.startsWith('http') ? image : `${SITE_URL}${image}`;

  return (
    <SEO
      title={fullTitle}
      description={description}
      keywords={`${product.name}, organic ${category || 'product'} Pakistan, natural ${category || 'product'} online, buy ${product.name.toLowerCase()} Pakistan`}
      image={imageUrl}
      type="product"
      url={productUrl}
      price={product.price}
      availability={product.stock_quantity > 0 ? 'in stock' : 'out of stock'}
    />
  );
}

export function PaginationSEO({ currentPage, totalPages, baseUrl }) {
  const canonical = currentPage === 1 ? baseUrl : `${baseUrl}?page=${currentPage}`;
  const nextPage = currentPage < totalPages ? `${baseUrl}?page=${currentPage + 1}` : null;
  const prevPage = currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}` : null;

  return (
    <SEO
      title={`Page ${currentPage}`}
      description={`Browse organic products page ${currentPage} of ${totalPages}. Premium quality, sustainably sourced products in Pakistan.`}
      url={canonical}
      canonicalUrl={baseUrl}
    />
  );
}

export function BlogPostSEO({ title, description, url, date, author, image }) {
  const fullTitle = title ? `${title} | Naturanza Food Blog` : 'Naturanza Food Blog';
  const imageUrl = image ? (image.startsWith('http') ? image : `${SITE_URL}${image}`) : `${SITE_URL}/images/logo.png`;

  return (
    <SEO
      title={title}
      description={description}
      type="article"
      url={url}
      image={imageUrl}
      keywords={`${title}, naturanza food blog, organic food Pakistan, health tips`}
    />
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
