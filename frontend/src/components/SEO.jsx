import { Helmet } from 'react-helmet-async';

/**
 * SEO Component - Manages meta tags, Open Graph, and Twitter Cards
 * @param {string} title - Page title
 * @param {string} description - Page description
 * @param {string} keywords - SEO keywords (comma-separated)
 * @param {string} image - OG image URL
 * @param {string} type - Page type (website, article, product)
 * @param {string} url - Canonical URL
 * @param {string} author - Content author
 */
export function SEO({ 
  title, 
  description, 
  keywords = '',
  image = '/images/og-image.jpg',
  type = 'website',
  url,
  author = 'Naturanza Food',
  price,
  currency = 'PKR',
  availability = 'in stock'
}) {
  const siteTitle = 'Naturanza Food - Premium Organic & Natural Products';
  const siteDescription = 'Discover premium organic honey, herbal teas, natural supplements, and wellness products. 100% natural, sustainably sourced, and delivered fresh to your door.';
  
  const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle;
  const finalDescription = description || siteDescription;
  const canonicalUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const imageUrl = image.startsWith('http') ? image : `${typeof window !== 'undefined' ? window.location.origin : ''}${image}`;

  // Default keywords
  const defaultKeywords = 'organic food, natural products, honey, herbal tea, supplements, wellness, organic Pakistan, natural food store';
  const finalKeywords = keywords ? `${keywords}, ${defaultKeywords}` : defaultKeywords;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={finalDescription} />
      {finalKeywords && <meta name="keywords" content={finalKeywords} />}
      <meta name="author" content={author} />
      
      {/* Viewport & Mobile */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#22c55e" />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Naturanza Food" />
      <meta property="og:locale" content="en_US" />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:site" content="@naturanzafood" />
      <meta name="twitter:creator" content="@naturanzafood" />
      
      {/* Canonical URL */}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
      
      {/* Additional Meta */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />
      
      {/* Product specific meta (if price is provided) */}
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

/**
 * Homepage SEO - Pre-configured for home page
 */
export function HomeSEO() {
  return (
    <SEO
      title="Home"
      description="Shop premium organic honey, herbal teas, natural supplements, and wellness products. 100% natural, sustainably sourced. Free shipping on orders over Rs. 2000."
      keywords="organic food Pakistan, natural products, buy organic honey, herbal tea online, natural supplements"
      type="website"
    />
  );
}

/**
 * Shop SEO - Pre-configured for shop page
 */
export function ShopSEO({ category }) {
  const categoryTitles = {
    honey: 'Organic Honey',
    'herbal-teas': 'Herbal Teas',
    supplements: 'Natural Supplements',
    oils: 'Natural Oils',
    seeds: 'Organic Seeds'
  };

  const title = category ? categoryTitles[category] || 'Shop' : 'Shop All Products';
  const description = category 
    ? `Browse our premium ${categoryTitles[category]?.toLowerCase() || 'products'}. 100% natural and organic.`
    : 'Browse our complete range of organic and natural products. Premium quality, sustainably sourced.';

  return (
    <SEO
      title={title}
      description={description}
      keywords={`${category || 'organic products'}, natural food, buy online Pakistan`}
      type="website"
    />
  );
}
