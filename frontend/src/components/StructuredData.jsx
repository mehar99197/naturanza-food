import { Helmet } from 'react-helmet-async';
import { useOptionalSettings } from '@/context/SettingsContext';
import { BUSINESS_INFO, SHIPPING_POLICY, RETURNS_POLICY } from '@/config/legal';
import { convertFromPkr, hasExchangeRate } from '@/lib/exchangeRates';
import { getConfiguredSocialUrls } from '@/lib/socialLinks';
import { SITE_URL } from '@/config/site';

const normalizePhone = (value) => String(value || '').replace(/[^\d+]/g, '');

const buildPostalAddress = (address) => {
  const trimmedAddress = String(address || '').trim();
  if (trimmedAddress && trimmedAddress !== BUSINESS_INFO.officeAddress) {
    return {
      "@type": "PostalAddress",
      "streetAddress": trimmedAddress,
      "addressCountry": BUSINESS_INFO.addressComponents.addressCountry,
    };
  }
  return {
    "@type": "PostalAddress",
    "streetAddress": BUSINESS_INFO.addressComponents.streetAddress,
    "addressLocality": BUSINESS_INFO.addressComponents.addressLocality,
    "addressRegion": BUSINESS_INFO.addressComponents.addressRegion,
    "addressCountry": BUSINESS_INFO.addressComponents.addressCountry,
  };
};

export function OrganizationStructuredData() {
  const { settings } = useOptionalSettings();
  const storeName = settings.storeName || BUSINESS_INFO.brandName;
  const supportEmail = settings.storeEmail || BUSINESS_INFO.contacts.supportEmail;
  const supportPhoneRaw = settings.storePhone || BUSINESS_INFO.contacts.phone;
  const supportPhone = normalizePhone(supportPhoneRaw);
  const currency = String(settings.currency || 'PKR').toUpperCase();
  const displayCurrency = hasExchangeRate(currency) ? currency : 'PKR';
  const sameAs = getConfiguredSocialUrls(settings, {
    includeWhatsapp: true,
    fallbackWhatsapp: supportPhone || '923409502646',
  });
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": storeName,
    "legalName": BUSINESS_INFO.legalName,
    "description": "Pakistan's trusted online store for pure organic honey, ispaghol husk, organic spices, and natural wellness products. 100% natural and sustainably sourced.",
    "url": SITE_URL,
    "logo": `${SITE_URL}/images/logo.png`,
    "image": `${SITE_URL}/images/logo.png`,
    "telephone": supportPhone,
    "email": supportEmail,
    "address": buildPostalAddress(settings.address),
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
    "sameAs": sameAs,
    "areaServed": {
      "@type": "Country",
      "name": "Pakistan"
    },
    "priceRange": displayCurrency,
    "currenciesAccepted": displayCurrency,
    "paymentAccepted": "SafePay (Visa, Mastercard, Raast, Mobile Wallets), Cash on Delivery"
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
  const { settings } = useOptionalSettings();
  const storeName = settings.storeName || BUSINESS_INFO.brandName;
  const supportEmail = settings.storeEmail || BUSINESS_INFO.contacts.supportEmail;
  const supportPhoneRaw = settings.storePhone || BUSINESS_INFO.contacts.phone;
  const supportPhone = normalizePhone(supportPhoneRaw);
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": storeName,
    "legalName": BUSINESS_INFO.legalName,
    "description": "Online organic food store delivering premium natural products across Pakistan",
    "url": SITE_URL,
    "image": `${SITE_URL}/images/logo.png`,
    "telephone": supportPhone,
    "email": supportEmail,
    "address": buildPostalAddress(settings.address),
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": Number.isFinite(Number(settings.mapLatitude)) ? Number(settings.mapLatitude) : 30.9716931,
      "longitude": Number.isFinite(Number(settings.mapLongitude)) ? Number(settings.mapLongitude) : 73.8896874
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      "opens": "00:00",
      "closes": "23:59"
    },
    "sameAs": getConfiguredSocialUrls(settings)
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(data)}
      </script>
    </Helmet>
  );
}

export function BlogStructuredData({ posts }) {
  const { settings } = useOptionalSettings();
  const storeName = settings.storeName || BUSINESS_INFO.brandName;
  const blogData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": `${storeName} Blog`,
    "description": "Expert articles on organic honey, ispaghol husk, organic spices, and natural wellness tips from Pakistan's trusted organic store.",
    "url": `${SITE_URL}/blog`,
    "blogPost": posts.map(post => ({
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.excerpt,
      "url": `${SITE_URL}/blog/${post.slug}`,
      "author": {
        "@type": post.author ? "Person" : "Organization",
        "name": post.author || storeName
      },
      "datePublished": post.date,
      "image": post.image
        ? (/^https?:\/\//i.test(post.image)
            ? post.image
            : `${SITE_URL}${post.image.startsWith('/') ? '' : '/'}${post.image}`)
        : undefined,
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
  const { settings } = useOptionalSettings();
  const storeName = settings.storeName || BUSINESS_INFO.brandName;
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": storeName,
    "description": "Premium Organic & Natural Products in Pakistan - Shop online for organic honey, ispaghol husk, organic spices and more",
    "url": SITE_URL,
    "inLanguage": "en-PK",
    "publisher": {
      "@type": "Organization",
      "name": storeName,
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
  const { settings } = useOptionalSettings();
  const storeName = settings.storeName || BUSINESS_INFO.brandName;
  const currency = String(settings.currency || 'PKR').toUpperCase();
  const hasRate = hasExchangeRate(currency);
  const displayCurrency = hasRate ? currency : 'PKR';
  const hasShippingFlat =
    settings.shippingFlat !== '' &&
    settings.shippingFlat !== null &&
    settings.shippingFlat !== undefined;
  const parsedShippingFlat = Number(settings.shippingFlat);
  const shippingFlat =
    hasShippingFlat && Number.isFinite(parsedShippingFlat) && parsedShippingFlat >= 0
      ? parsedShippingFlat
      : SHIPPING_POLICY.defaultShippingFlatAmount;
  const hasShippingFree =
    settings.shippingFree !== '' &&
    settings.shippingFree !== null &&
    settings.shippingFree !== undefined;
  const parsedShippingFree = Number(settings.shippingFree);
  const shippingFree =
    hasShippingFree && Number.isFinite(parsedShippingFree) && parsedShippingFree >= 0
      ? parsedShippingFree
      : SHIPPING_POLICY.freeShippingThresholdAmount;
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
    "name": `Shipping and Delivery Information - ${storeName}`,
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
          "@type": "QuantitativeValue",
          "minValue": 3,
          "maxValue": 5,
          "unitCode": "DAY"
        }
      }
    },
    "hasMerchantReturnPolicy": {
      "@type": "MerchantReturnPolicy",
      "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
      "merchantReturnDays": RETURNS_POLICY.returnWindowDays,
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
  const { settings } = useOptionalSettings();
  const storeName = settings.storeName || BUSINESS_INFO.brandName;
  const data = {
    "@context": "https://schema.org",
    "@type": "MerchantReturnPolicy",
    "name": `Returns and Refunds Policy - ${storeName}`,
    "url": `${SITE_URL}/returns`,
    "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
    "merchantReturnDays": RETURNS_POLICY.returnWindowDays,
    "returnMethod": "https://schema.org/ReturnByMail",
    "returnFees": "https://schema.org/FreeReturn",
    "description": `Returns accepted within ${RETURNS_POLICY.returnWindow} of delivery for damaged, defective, or incorrect items in original sealed packaging. Approved refunds processed within ${RETURNS_POLICY.refundWindow}.`,
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
  const { settings } = useOptionalSettings();
  const storeName = settings.storeName || BUSINESS_INFO.brandName;
  const categoryNames = {
    honey: 'Organic Honey',
    ispaghol: 'Ispaghol Husk',
    spices: 'Organic Spices',
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
    "name": `${name} | ${storeName}`,
    "description": `Shop premium ${name.toLowerCase()} online in Pakistan. 100% natural, sustainably sourced products.`,
    "url": url,
    "isPartOf": {
      "@type": "WebSite",
      "name": storeName,
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
  const { settings } = useOptionalSettings();
  const storeName = settings.storeName || BUSINESS_INFO.brandName;
  const resolvedImage = image
    ? (/^https?:\/\//i.test(image)
        ? image
        : `${SITE_URL}${image.startsWith('/') ? '' : '/'}${image}`)
    : `${SITE_URL}/images/logo.png`;
  const data = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "url": url || SITE_URL,
    "author": {
      "@type": author ? "Person" : "Organization",
      "name": author || storeName
    },
    "publisher": {
      "@type": "Organization",
      "name": storeName,
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_URL}/images/logo.png`
      }
    },
    "datePublished": datePublished || new Date().toISOString(),
    "dateModified": new Date().toISOString(),
    "image": resolvedImage,
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
