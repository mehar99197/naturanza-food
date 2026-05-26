import { Helmet } from 'react-helmet-async';
import { useSettings } from '@/context/SettingsContext';
import { BUSINESS_INFO } from '@/config/legal';
import { convertFromPkr, hasExchangeRate } from '@/lib/exchangeRates';
import { SITE_URL } from '@/config/site';

const normalizePhone = (value) => String(value || '').replace(/[^\d+]/g, '');

export function OrganizationStructuredData() {
  const { settings } = useSettings();
  const supportEmail = settings.storeEmail || BUSINESS_INFO.contacts.supportEmail;
  const supportPhoneRaw = settings.storePhone || BUSINESS_INFO.contacts.phone;
  const supportPhone = normalizePhone(supportPhoneRaw);
  const currency = String(settings.currency || 'PKR').toUpperCase();
  const displayCurrency = hasExchangeRate(currency) ? currency : 'PKR';
  const whatsappNumber = supportPhone.replace(/^\+/, '') || '923409502646';
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Naturanza Food",
    "description": "Pakistan's trusted online store for premium organic honey, herbal teas, natural supplements, and wellness products. 100% natural and sustainably sourced.",
    "url": SITE_URL,
    "logo": `${SITE_URL}/images/logo.png`,
    "image": `${SITE_URL}/images/logo.png`,
    "telephone": supportPhone,
    "email": supportEmail,
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "PK",
      "addressRegion": "Pakistan"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": supportPhone,
      "contactType": "Customer Service",
      "areaServed": "PK",
      "availableLanguage": ["English", "Urdu"],
      "hoursAvailable": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        "opens": "00:00",
        "closes": "23:59"
      }
    },
    "sameAs": [
      "https://www.facebook.com/naturanzafood",
      "https://www.instagram.com/naturanzafood",
      "https://www.twitter.com/naturanzafood",
      `https://wa.me/${whatsappNumber}`
    ],
    "areaServed": {
      "@type": "Country",
      "name": "Pakistan"
    },
    "priceRange": displayCurrency,
    "currenciesAccepted": displayCurrency,
    "paymentAccepted": "Cash on Delivery, Credit Card, Bank Transfer"
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(data)}
      </script>
    </Helmet>
  );
}

export function LocalBusinessStructuredData() {
  const { settings } = useSettings();
  const supportEmail = settings.storeEmail || BUSINESS_INFO.contacts.supportEmail;
  const supportPhoneRaw = settings.storePhone || BUSINESS_INFO.contacts.phone;
  const supportPhone = normalizePhone(supportPhoneRaw);
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Naturanza Food",
    "description": "Online organic food store delivering premium natural products across Pakistan",
    "url": SITE_URL,
    "image": `${SITE_URL}/images/logo.png`,
    "telephone": supportPhone,
    "email": supportEmail,
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "PK"
    },
    "geo": {
      "@type": "Geo",
      "addressCountry": "Pakistan"
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      "opens": "00:00",
      "closes": "23:59"
    },
    "sameAs": [
      "https://www.facebook.com/naturanzafood",
      "https://www.instagram.com/naturanzafood"
    ]
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(data)}
      </script>
    </Helmet>
  );
}

export function ProductStructuredData({ product }) {
  const { settings } = useSettings();
  if (!product) return null;

  const currency = String(settings.currency || 'PKR').toUpperCase();
  const hasRate = hasExchangeRate(currency);
  const displayCurrency = hasRate ? currency : 'PKR';
  const shippingFlat = Number.isFinite(Number(settings.shippingFlat))
    ? Number(settings.shippingFlat)
    : 250;
  const shippingFree = Number.isFinite(Number(settings.shippingFree))
    ? Number(settings.shippingFree)
    : 2000;
  const productPrice = Number(product.price) || 0;
  const toDisplayCurrencyValue = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return numeric;
    }
    if (!hasRate || displayCurrency === 'PKR') {
      return numeric;
    }
    return convertFromPkr(numeric, displayCurrency) ?? numeric;
  };
  const displayProductPrice = toDisplayCurrencyValue(productPrice);
  const displayShippingFlat = toDisplayCurrencyValue(shippingFlat);
  const productUrl = typeof window !== 'undefined' ? window.location.href : `${SITE_URL}/product/${product.id}`;
  const imageUrl = product.image_url || product.image || `${SITE_URL}/images/logo.png`;
  const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${SITE_URL}${imageUrl}`;

  const productData = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description || `${product.name} - Premium organic product from Naturanza Food`,
    "image": fullImageUrl,
    "sku": product.sku || `PROD-${product.id}`,
    "mpn": product.sku || `PROD-${product.id}`,
    "brand": {
      "@type": "Brand",
      "name": "Naturanza Food"
    },
    "manufacturer": {
      "@type": "Organization",
      "name": "Naturanza Food"
    },
    "category": product.category_name || product.category || 'Organic Products',
    "offers": {
      "@type": "Offer",
      "url": productUrl,
      "priceCurrency": displayCurrency,
      "price": displayProductPrice,
      "priceValidUntil": new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      "availability": product.stock_quantity > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": {
        "@type": "Organization",
        "name": "Naturanza Food"
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": productPrice >= shippingFree ? "0" : String(displayShippingFlat),
          "currency": displayCurrency
        },
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "PK"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTimeSpecification",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 0,
            "maxValue": 1,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 2,
            "maxValue": 5,
            "unitCode": "BUSINESS_DAY"
          }
        }
      }
    },
    "aggregateRating": product.averageRating ? {
      "@type": "AggregateRating",
      "ratingValue": product.averageRating,
      "reviewCount": product.reviewCount || 0,
      "bestRating": 5,
      "worstRating": 1
    } : undefined,
    "review": product.reviews?.slice(0, 5).map(review => ({
      "@type": "Review",
      "author": {
        "@type": "Person",
        "name": review.userName || review.name || 'Verified Buyer'
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": review.rating,
        "bestRating": 5,
        "worstRating": 1
      },
      "reviewBody": review.comment,
      "datePublished": review.date || new Date().toISOString()
    })) || undefined
  };

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

export function BlogStructuredData({ posts }) {
  const blogData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Naturanza Food Blog",
    "description": "Expert articles on organic honey, herbal teas, natural supplements, and health tips from Pakistan's trusted organic store.",
    "url": `${SITE_URL}/blog`,
    "blogPost": posts.map(post => ({
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.excerpt,
      "url": `${SITE_URL}/blog/${post.slug}`,
      "author": {
        "@type": "Organization",
        "name": "Naturanza Food"
      },
      "datePublished": post.date,
      "image": post.image ? `${SITE_URL}${post.image}` : undefined,
      "articleSection": post.category
    }))
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(blogData)}
      </script>
    </Helmet>
  );
}

export function BreadcrumbStructuredData({ items }) {
  if (!items || items.length === 0) return null;

  const data = {
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
        {JSON.stringify(data)}
      </script>
    </Helmet>
  );
}

export function WebsiteStructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Naturanza Food",
    "description": "Premium Organic & Natural Products in Pakistan - Shop online for organic honey, herbal teas, supplements and more",
    "url": SITE_URL,
    "inLanguage": "en-PK",
    "publisher": {
      "@type": "Organization",
      "name": "Naturanza Food",
      "url": SITE_URL,
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_URL}/images/logo.png`
      }
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${SITE_URL}/shop?search={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(data)}
      </script>
    </Helmet>
  );
}

export function FAQStructuredData({ faqs }) {
  const faqData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(faqData)}
      </script>
    </Helmet>
  );
}

export function ShippingPolicyStructuredData() {
  const { settings } = useSettings();
  const currency = String(settings.currency || 'PKR').toUpperCase();
  const hasRate = hasExchangeRate(currency);
  const displayCurrency = hasRate ? currency : 'PKR';
  const shippingFlat = Number.isFinite(Number(settings.shippingFlat))
    ? Number(settings.shippingFlat)
    : 250;
  const shippingFree = Number.isFinite(Number(settings.shippingFree))
    ? Number(settings.shippingFree)
    : 2000;
  const toDisplayCurrencyValue = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return numeric;
    }
    if (!hasRate || displayCurrency === 'PKR') {
      return numeric;
    }
    return convertFromPkr(numeric, displayCurrency) ?? numeric;
  };
  const displayShippingFlat = toDisplayCurrencyValue(shippingFlat);
  const displayShippingFree = toDisplayCurrencyValue(shippingFree);
  const data = {
    "@context": "https://schema.org",
    "@type": "ShippingPolicy",
    "name": "Shipping and Delivery Information - Naturanza Food",
    "url": `${SITE_URL}/shipping`,
    "shippingDetails": {
      "@type": "OfferShippingDetails",
      "shippingRate": {
        "@type": "MonetaryAmount",
        "value": String(displayShippingFlat),
        "currency": displayCurrency
      },
      "freeShippingThreshold": {
        "@type": "MonetaryAmount",
        "value": String(displayShippingFree),
        "currency": displayCurrency
      },
      "shippingDestination": {
        "@type": "DefinedRegion",
        "addressCountry": "PK"
      },
      "deliveryTime": {
        "@type": "ShippingDeliveryTimeSpecification",
        "handlingTime": {
          "@type": "QuantitativeValue",
          "minValue": 0,
          "maxValue": 1,
          "unitCode": "DAY"
        },
        "transitTime": {
          "@type": "ShippingDeliveryTimeSpecification",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 2,
            "maxValue": 5,
            "unitCode": "BUSINESS_DAY"
          }
        }
      }
    },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": 7,
      "returnMethod": "https://schema.org/ReturnByMail",
      "returnFees": "https://schema.org/FreeReturn"
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(data)}
      </script>
    </Helmet>
  );
}

export function ReturnPolicyStructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@type": "MerchantReturnPolicy",
    "name": "Returns and Refunds Policy - Naturanza Food",
    "url": `${SITE_URL}/returns`,
    "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
    "merchantReturnDays": 7,
    "returnMethod": "https://schema.org/ReturnByMail",
    "returnFees": "https://schema.org/FreeReturn",
    "description": "Items must be unused, sealed, and in original packaging. Refunds processed within 5-10 business days after quality check.",
    "applicableCountry": "PK"
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(data)}
      </script>
    </Helmet>
  );
}

export function ShopBreadcrumbStructuredData({ category }) {
  const items = [
    { name: "Home", url: SITE_URL },
    { name: "Shop", url: `${SITE_URL}/shop` }
  ];

  if (category && category !== 'all') {
    const categoryName = category
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    items.push({
      name: categoryName,
      url: `${SITE_URL}/shop/${category}`
    });
  }

  return <BreadcrumbStructuredData items={items} />;
}

export function ReviewStructuredData({ review, product }) {
  if (!review || !product) return null;

  const data = {
    "@context": "https://schema.org",
    "@type": "Review",
    "itemReviewed": {
      "@type": "Product",
      "name": product.name
    },
    "author": {
      "@type": "Person",
      "name": review.userName || review.name || 'Verified Buyer'
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
        {JSON.stringify(data)}
      </script>
    </Helmet>
  );
}

export function CollectionPageStructuredData({ category, productCount }) {
  const categoryNames = {
    honey: 'Organic Honey',
    'herbal-teas': 'Herbal Teas',
    supplements: 'Natural Supplements',
    oils: 'Natural Oils',
    seeds: 'Organic Seeds'
  };

  const name = category ? categoryNames[category] || 'Products' : 'All Products';
  const url = category ? `${SITE_URL}/shop/${category}` : `${SITE_URL}/shop`;

  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `${name} | Naturanza Food`,
    "description": `Shop premium ${name.toLowerCase()} online in Pakistan. 100% natural, sustainably sourced products.`,
    "url": url,
    "isPartOf": {
      "@type": "WebSite",
      "name": "Naturanza Food",
      "url": SITE_URL
    },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": productCount || 0,
      "itemListElement": []
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(data)}
      </script>
    </Helmet>
  );
}

export function ArticleStructuredData({ title, description, url, author, datePublished, image }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "url": url || SITE_URL,
    "author": {
      "@type": "Organization",
      "name": "Naturanza Food"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Naturanza Food",
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_URL}/images/logo.png`
      }
    },
    "datePublished": datePublished || new Date().toISOString(),
    "dateModified": new Date().toISOString(),
    "image": image || `${SITE_URL}/images/logo.png`,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": url || SITE_URL
    }
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(data)}
      </script>
    </Helmet>
  );
}
