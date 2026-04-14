import { Helmet } from 'react-helmet-async';

/**
 * Organization Structured Data
 */
export function OrganizationStructuredData() {
  const organizationData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Naturanza Food",
    "description": "Premium organic and natural food products delivered to your door",
    "url": typeof window !== 'undefined' ? window.location.origin : 'https://naturanzafood.com',
    "logo": typeof window !== 'undefined' ? `${window.location.origin}/images/logo.png` : 'https://naturanzafood.com/images/logo.png',
    "image": typeof window !== 'undefined' ? `${window.location.origin}/images/og-image.jpg` : 'https://naturanzafood.com/images/og-image.jpg',
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+92-300-1234567",
      "contactType": "Customer Service",
      "areaServed": "PK",
      "availableLanguage": ["English", "Urdu"]
    },
    "sameAs": [
      "https://facebook.com/naturanzafood",
      "https://instagram.com/naturanzafood",
      "https://twitter.com/naturanzafood"
    ]
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(organizationData)}
      </script>
    </Helmet>
  );
}

/**
 * Product Structured Data
 */
export function ProductStructuredData({ product }) {
  if (!product) return null;

  const productData = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "description": product.description,
    "image": product.image_url || product.image,
    "sku": product.sku || `PROD-${product.id}`,
    "brand": {
      "@type": "Brand",
      "name": "Naturanza Food"
    },
    "offers": {
      "@type": "Offer",
      "url": typeof window !== 'undefined' ? window.location.href : '',
      "priceCurrency": "PKR",
      "price": product.price,
      "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": product.stock_quantity > 0 
        ? "https://schema.org/InStock" 
        : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": "Naturanza Food"
      }
    },
    "aggregateRating": product.averageRating ? {
      "@type": "AggregateRating",
      "ratingValue": product.averageRating,
      "reviewCount": product.reviewCount || 0,
      "bestRating": 5,
      "worstRating": 1
    } : undefined
  };

  // Remove undefined fields
  Object.keys(productData).forEach(key => 
    productData[key] === undefined && delete productData[key]
  );

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(productData)}
      </script>
    </Helmet>
  );
}

/**
 * Breadcrumb Structured Data
 */
export function BreadcrumbStructuredData({ items }) {
  if (!items || items.length === 0) return null;

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url
    }))
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbData)}
      </script>
    </Helmet>
  );
}

/**
 * Website Structured Data
 */
export function WebsiteStructuredData() {
  const websiteData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Naturanza Food",
    "description": "Premium Organic & Natural Products",
    "url": typeof window !== 'undefined' ? window.location.origin : 'https://naturanzafood.com',
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": typeof window !== 'undefined' 
          ? `${window.location.origin}/shop?search={search_term_string}`
          : 'https://naturanzafood.com/shop?search={search_term_string}'
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(websiteData)}
      </script>
    </Helmet>
  );
}

/**
 * Review Structured Data
 */
export function ReviewStructuredData({ review, product }) {
  if (!review || !product) return null;

  const reviewData = {
    "@context": "https://schema.org",
    "@type": "Review",
    "itemReviewed": {
      "@type": "Product",
      "name": product.name
    },
    "author": {
      "@type": "Person",
      "name": review.userName || review.name || 'Anonymous'
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": review.rating,
      "bestRating": 5,
      "worstRating": 1
    },
    "reviewBody": review.comment,
    "datePublished": review.date || new Date().toISOString()
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(reviewData)}
      </script>
    </Helmet>
  );
}
