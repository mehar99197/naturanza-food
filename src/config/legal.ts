/**
 * Business identity and policy wording quoted verbatim by the legal pages
 * (terms, privacy, shipping, returns). Mirrors frontend/src/config/legal.js so
 * a page reads the same values before and after it migrates.
 *
 * Frozen with `as const` because these values are shared across pages and are
 * only ever read.
 */
export const BUSINESS_INFO = {
  legalName: "Naturanza Food",
  brandName: "Naturanza Food",
  websiteDomain: "www.naturanzafood.com",
  officeAddress: "Pakistan",
  governingLaw: "Laws of Pakistan",
  supportHours: "Available 24/7",
  contacts: {
    supportEmail: "support@naturanzafood.com",
    legalEmail: "support@naturanzafood.com",
    privacyEmail: "support@naturanzafood.com",
    shippingEmail: "support@naturanzafood.com",
    returnsEmail: "support@naturanzafood.com",
    phone: "+92340 9502646",
  },
} as const;

export const SHIPPING_POLICY = {
  dispatchCity: "Lahore",
  standardWindow: "2 to 5 business days",
  expressWindow: "1 to 2 business days",
  freeShippingThreshold: "Rs. 5,000",
} as const;

export const RETURNS_POLICY = {
  returnWindow: "3 days",
  inspectionWindow: "2 business days",
  refundWindow: "5 to 10 business days",
} as const;

export type BusinessInfo = typeof BUSINESS_INFO;
export type BusinessContacts = BusinessInfo["contacts"];
export type ShippingPolicy = typeof SHIPPING_POLICY;
export type ReturnsPolicy = typeof RETURNS_POLICY;
