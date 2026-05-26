import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

export function initAnalytics() {
  if (typeof window === 'undefined' || !GA_MEASUREMENT_ID) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_title: document.title,
    page_location: window.location.href
  });
}

export function trackEvent(eventName, parameters = {}) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', eventName, parameters);
}

export function trackPageView(pagePath, pageTitle) {
  if (typeof window === 'undefined' || !window.gtag || !GA_MEASUREMENT_ID) return;
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: pagePath,
    page_title: pageTitle
  });
}

export function trackPurchase(orderData) {
  trackEvent('purchase', {
    transaction_id: orderData.orderId,
    value: orderData.total,
    currency: 'PKR',
    items: orderData.items.map(item => ({
      item_id: item.id,
      item_name: item.name,
      item_category: item.category,
      price: item.price,
      quantity: item.quantity
    }))
  });
}

export function trackAddToCart(productData) {
  trackEvent('add_to_cart', {
    currency: 'PKR',
    value: productData.price,
    items: [{
      item_id: productData.id,
      item_name: productData.name,
      item_category: productData.category,
      price: productData.price,
      quantity: productData.quantity || 1
    }]
  });
}

export function trackViewItem(productData) {
  trackEvent('view_item', {
    currency: 'PKR',
    value: productData.price,
    items: [{
      item_id: productData.id,
      item_name: productData.name,
      item_category: productData.category,
      price: productData.price
    }]
  });
}

export function trackSearch(searchTerm) {
  trackEvent('search', {
    search_term: searchTerm
  });
}

export function trackSignUp(method) {
  trackEvent('sign_up', {
    method: method
  });
}

export function trackLead(source) {
  trackEvent('generate_lead', {
    source: source
  });
}

export function trackBeginCheckout(checkoutData) {
  trackEvent('begin_checkout', {
    currency: 'PKR',
    value: checkoutData.total,
    items: checkoutData.items.map(item => ({
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: item.quantity
    }))
  });
}

// Forward a single Core Web Vital sample to GA4 as a custom event.
// Google Search ranks pages partly on CWV — having this in prod lets us
// see field data, not just lab data from Lighthouse.
function reportVital({ name, value, id, rating }) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, {
    event_category: 'Web Vitals',
    event_label: id,
    // INP/LCP/FCP/TTFB are milliseconds, CLS is a unitless score — GA4 expects integers.
    value: Math.round(name === 'CLS' ? value * 1000 : value),
    metric_id: id,
    metric_value: value,
    metric_rating: rating,
    non_interaction: true,
  });
}

export function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    trackPageView(location.pathname, document.title);
  }, [location]);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);

    const inlineScript = document.createElement('script');
    inlineScript.textContent = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_MEASUREMENT_ID}');
    `;
    document.head.appendChild(inlineScript);

    return () => {
      document.head.removeChild(script);
      document.head.removeChild(inlineScript);
    };
  }, []);

  useEffect(() => {
    // Dynamic import keeps web-vitals out of the critical bundle —
    // it loads after first paint, so it can't slow LCP itself.
    let cancelled = false;
    import('web-vitals').then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
      if (cancelled) return;
      onCLS(reportVital);
      onINP(reportVital);
      onLCP(reportVital);
      onFCP(reportVital);
      onTTFB(reportVital);
    }).catch(() => {
      // Library failure must never affect the app — swallow silently.
    });
    return () => { cancelled = true; };
  }, []);

  return null;
}

export default {
  initAnalytics,
  trackEvent,
  trackPageView,
  trackPurchase,
  trackAddToCart,
  trackViewItem,
  trackSearch,
  trackSignUp,
  trackLead,
  trackBeginCheckout,
  AnalyticsTracker
};