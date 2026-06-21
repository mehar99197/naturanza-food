const { dbPool } = require("../config/db");

const DEFAULT_ADMIN_SETTINGS = {
  storeName: process.env.BUSINESS_LEGAL_NAME || "Naturanza",
  storeEmail: process.env.BUSINESS_SUPPORT_EMAIL || "support@naturanzafood.com",
  storePhone: process.env.BUSINESS_SUPPORT_PHONE || "+92340 9502646",
  currency: "PKR",
  taxRate: 18,
  shippingFlat: 250,
  shippingFree: 5000,
  emailNotifications: true,
  orderNotifications: true,
  lowStockAlerts: true,
  lowStockThreshold: 10,
  address: "Pakistan",
  supportHours: "Available 24/7",
  facebookUrl: "",
  instagramUrl: "",
  twitterUrl: "",
  youtubeUrl: "",
  whatsappNumber: "",
  whatsappEnabled: true,
  mapLatitude: 31.5204,
  mapLongitude: 74.3587,
  mapLocationLabel: "Pakistan, Lahore",
  newsletterWelcomePromoCode: "",
  storeDiscountActive: false,
  storeDiscountPercentage: 0,
  storeDiscountLabel: "Store Sale",
};

const toBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toTrimmedString = (value, fallback = "") => {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value).trim();
};

const normalizeSettingsRow = (row = {}) => ({
  storeName: row.store_name || DEFAULT_ADMIN_SETTINGS.storeName,
  storeEmail: row.store_email || DEFAULT_ADMIN_SETTINGS.storeEmail,
  storePhone: row.store_phone || DEFAULT_ADMIN_SETTINGS.storePhone,
  currency: row.currency || DEFAULT_ADMIN_SETTINGS.currency,
  taxRate: toNumber(row.tax_rate, DEFAULT_ADMIN_SETTINGS.taxRate),
  shippingFlat: toNumber(row.shipping_flat, DEFAULT_ADMIN_SETTINGS.shippingFlat),
  shippingFree: toNumber(row.shipping_free, DEFAULT_ADMIN_SETTINGS.shippingFree),
  emailNotifications: toBoolean(
    row.email_notifications,
    DEFAULT_ADMIN_SETTINGS.emailNotifications,
  ),
  orderNotifications: toBoolean(
    row.order_notifications,
    DEFAULT_ADMIN_SETTINGS.orderNotifications,
  ),
  lowStockAlerts: toBoolean(row.low_stock_alerts, DEFAULT_ADMIN_SETTINGS.lowStockAlerts),
  lowStockThreshold: toNumber(
    row.low_stock_threshold,
    DEFAULT_ADMIN_SETTINGS.lowStockThreshold,
  ),
  address:
    row.address === undefined || row.address === null
      ? DEFAULT_ADMIN_SETTINGS.address
      : String(row.address),
  supportHours:
    row.support_hours === undefined || row.support_hours === null
      ? DEFAULT_ADMIN_SETTINGS.supportHours
      : String(row.support_hours),
  facebookUrl: row.facebook_url == null ? "" : String(row.facebook_url),
  instagramUrl: row.instagram_url == null ? "" : String(row.instagram_url),
  twitterUrl: row.twitter_url == null ? "" : String(row.twitter_url),
  youtubeUrl: row.youtube_url == null ? "" : String(row.youtube_url),
  whatsappNumber: row.whatsapp_number == null ? "" : String(row.whatsapp_number),
  whatsappEnabled: toBoolean(row.whatsapp_enabled, DEFAULT_ADMIN_SETTINGS.whatsappEnabled),
  mapLatitude: toNumber(row.map_latitude, DEFAULT_ADMIN_SETTINGS.mapLatitude),
  mapLongitude: toNumber(row.map_longitude, DEFAULT_ADMIN_SETTINGS.mapLongitude),
  mapLocationLabel:
    row.map_location_label === undefined || row.map_location_label === null
      ? DEFAULT_ADMIN_SETTINGS.mapLocationLabel
      : String(row.map_location_label),
  newsletterWelcomePromoCode:
    row.newsletter_welcome_promo_code == null
      ? ""
      : String(row.newsletter_welcome_promo_code),
  storeDiscountActive: toBoolean(
    row.store_discount_active,
    DEFAULT_ADMIN_SETTINGS.storeDiscountActive,
  ),
  storeDiscountPercentage: toNumber(
    row.store_discount_percentage,
    DEFAULT_ADMIN_SETTINGS.storeDiscountPercentage,
  ),
  storeDiscountLabel:
    row.store_discount_label == null
      ? DEFAULT_ADMIN_SETTINGS.storeDiscountLabel
      : String(row.store_discount_label),
});

const getAdminSettings = async (connection = null) => {
  const db = connection || dbPool;
  const [rows] = await db.query("SELECT * FROM admin_settings WHERE id = 1 LIMIT 1");

  if (rows.length) {
    return normalizeSettingsRow(rows[0]);
  }

  const defaults = DEFAULT_ADMIN_SETTINGS;

  await db.query(
    `INSERT INTO admin_settings
     (id, store_name, store_email, store_phone, currency, tax_rate, shipping_flat, shipping_free,
      email_notifications, order_notifications, low_stock_alerts, low_stock_threshold,
      address, support_hours, facebook_url, instagram_url, twitter_url, youtube_url,
      whatsapp_number, whatsapp_enabled, map_latitude, map_longitude, map_location_label,
      newsletter_welcome_promo_code, store_discount_active, store_discount_percentage,
      store_discount_label)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [
      defaults.storeName,
      defaults.storeEmail,
      defaults.storePhone,
      defaults.currency,
      defaults.taxRate,
      defaults.shippingFlat,
      defaults.shippingFree,
      defaults.emailNotifications,
      defaults.orderNotifications,
      defaults.lowStockAlerts,
      defaults.lowStockThreshold,
      defaults.address,
      defaults.supportHours,
      defaults.facebookUrl,
      defaults.instagramUrl,
      defaults.twitterUrl,
      defaults.youtubeUrl,
      defaults.whatsappNumber,
      defaults.whatsappEnabled,
      defaults.mapLatitude,
      defaults.mapLongitude,
      defaults.mapLocationLabel,
      defaults.newsletterWelcomePromoCode,
      defaults.storeDiscountActive,
      defaults.storeDiscountPercentage,
      defaults.storeDiscountLabel,
    ],
  );

  const [nextRows] = await db.query(
    "SELECT * FROM admin_settings WHERE id = 1 LIMIT 1",
  );

  return normalizeSettingsRow(nextRows[0] || {});
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const updateAdminSettings = async (connection = null, updates = {}) => {
  const db = connection || dbPool;
  const current = await getAdminSettings(db);
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(updates, key);

  const next = {
    ...current,
    ...(hasOwn("storeName") ? { storeName: String(updates.storeName || "").trim() } : {}),
    ...(hasOwn("storeEmail")
      ? { storeEmail: String(updates.storeEmail || "").trim().toLowerCase() }
      : {}),
    ...(hasOwn("storePhone")
      ? { storePhone: String(updates.storePhone || "").trim() }
      : {}),
    ...(hasOwn("currency")
      ? { currency: String(updates.currency || "PKR").trim().toUpperCase() }
      : {}),
    ...(hasOwn("taxRate")
      ? { taxRate: toNumber(updates.taxRate, current.taxRate) }
      : {}),
    ...(hasOwn("shippingFlat")
      ? { shippingFlat: toNumber(updates.shippingFlat, current.shippingFlat) }
      : {}),
    ...(hasOwn("shippingFree")
      ? { shippingFree: toNumber(updates.shippingFree, current.shippingFree) }
      : {}),
    ...(hasOwn("emailNotifications")
      ? { emailNotifications: toBoolean(updates.emailNotifications, current.emailNotifications) }
      : {}),
    ...(hasOwn("orderNotifications")
      ? { orderNotifications: toBoolean(updates.orderNotifications, current.orderNotifications) }
      : {}),
    ...(hasOwn("lowStockAlerts")
      ? { lowStockAlerts: toBoolean(updates.lowStockAlerts, current.lowStockAlerts) }
      : {}),
    ...(hasOwn("lowStockThreshold")
      ? { lowStockThreshold: toNumber(updates.lowStockThreshold, current.lowStockThreshold) }
      : {}),
    ...(hasOwn("address") ? { address: toTrimmedString(updates.address, current.address) } : {}),
    ...(hasOwn("supportHours")
      ? { supportHours: toTrimmedString(updates.supportHours, current.supportHours) }
      : {}),
    ...(hasOwn("facebookUrl") ? { facebookUrl: toTrimmedString(updates.facebookUrl) } : {}),
    ...(hasOwn("instagramUrl") ? { instagramUrl: toTrimmedString(updates.instagramUrl) } : {}),
    ...(hasOwn("twitterUrl") ? { twitterUrl: toTrimmedString(updates.twitterUrl) } : {}),
    ...(hasOwn("youtubeUrl") ? { youtubeUrl: toTrimmedString(updates.youtubeUrl) } : {}),
    ...(hasOwn("whatsappNumber")
      ? { whatsappNumber: toTrimmedString(updates.whatsappNumber) }
      : {}),
    ...(hasOwn("whatsappEnabled")
      ? { whatsappEnabled: toBoolean(updates.whatsappEnabled, current.whatsappEnabled) }
      : {}),
    ...(hasOwn("mapLatitude")
      ? { mapLatitude: clamp(toNumber(updates.mapLatitude, current.mapLatitude), -90, 90) }
      : {}),
    ...(hasOwn("mapLongitude")
      ? { mapLongitude: clamp(toNumber(updates.mapLongitude, current.mapLongitude), -180, 180) }
      : {}),
    ...(hasOwn("mapLocationLabel")
      ? { mapLocationLabel: toTrimmedString(updates.mapLocationLabel, current.mapLocationLabel) }
      : {}),
    ...(hasOwn("newsletterWelcomePromoCode")
      ? {
          newsletterWelcomePromoCode: toTrimmedString(updates.newsletterWelcomePromoCode)
            .toUpperCase()
            .slice(0, 40),
        }
      : {}),
    ...(hasOwn("storeDiscountActive")
      ? { storeDiscountActive: toBoolean(updates.storeDiscountActive, current.storeDiscountActive) }
      : {}),
    ...(hasOwn("storeDiscountPercentage")
      ? {
          storeDiscountPercentage: clamp(
            toNumber(updates.storeDiscountPercentage, current.storeDiscountPercentage),
            0,
            90,
          ),
        }
      : {}),
    ...(hasOwn("storeDiscountLabel")
      ? { storeDiscountLabel: toTrimmedString(updates.storeDiscountLabel, current.storeDiscountLabel).slice(0, 60) }
      : {}),
  };

  // Default currency to PKR if not set
  if (!next.currency) {
    next.currency = "PKR";
  }

  await db.query(
    `UPDATE admin_settings
     SET store_name = ?,
         store_email = ?,
         store_phone = ?,
         currency = ?,
         tax_rate = ?,
         shipping_flat = ?,
         shipping_free = ?,
         email_notifications = ?,
         order_notifications = ?,
         low_stock_alerts = ?,
         low_stock_threshold = ?,
         address = ?,
         support_hours = ?,
         facebook_url = ?,
         instagram_url = ?,
         twitter_url = ?,
         youtube_url = ?,
         whatsapp_number = ?,
         whatsapp_enabled = ?,
         map_latitude = ?,
         map_longitude = ?,
         map_location_label = ?,
         newsletter_welcome_promo_code = ?,
         store_discount_active = ?,
         store_discount_percentage = ?,
         store_discount_label = ?
     WHERE id = 1`,
    [
      next.storeName,
      next.storeEmail,
      next.storePhone,
      next.currency,
      next.taxRate,
      next.shippingFlat,
      next.shippingFree,
      next.emailNotifications,
      next.orderNotifications,
      next.lowStockAlerts,
      next.lowStockThreshold,
      next.address,
      next.supportHours,
      next.facebookUrl,
      next.instagramUrl,
      next.twitterUrl,
      next.youtubeUrl,
      next.whatsappNumber,
      next.whatsappEnabled,
      next.mapLatitude,
      next.mapLongitude,
      next.mapLocationLabel,
      next.newsletterWelcomePromoCode,
      next.storeDiscountActive,
      next.storeDiscountPercentage,
      next.storeDiscountLabel,
    ],
  );

  return {
    ...next,
    updatedAt: new Date().toISOString(),
  };
};

const toPublicSettings = (settings) => ({
  storeName: settings.storeName,
  storeEmail: settings.storeEmail,
  storePhone: settings.storePhone,
  currency: settings.currency || "PKR",
  taxRate: settings.taxRate,
  shippingFlat: settings.shippingFlat,
  shippingFree: settings.shippingFree,
  emailNotifications: settings.emailNotifications,
  orderNotifications: settings.orderNotifications,
  lowStockAlerts: settings.lowStockAlerts,
  lowStockThreshold: settings.lowStockThreshold,
  address: settings.address,
  supportHours: settings.supportHours,
  facebookUrl: settings.facebookUrl,
  instagramUrl: settings.instagramUrl,
  twitterUrl: settings.twitterUrl,
  youtubeUrl: settings.youtubeUrl,
  whatsappNumber: settings.whatsappNumber,
  whatsappEnabled: settings.whatsappEnabled,
  mapLatitude: settings.mapLatitude,
  mapLongitude: settings.mapLongitude,
  mapLocationLabel: settings.mapLocationLabel,
  storeDiscountActive: settings.storeDiscountActive,
  storeDiscountPercentage: settings.storeDiscountPercentage,
  storeDiscountLabel: settings.storeDiscountLabel,
});

module.exports = {
  DEFAULT_ADMIN_SETTINGS,
  getAdminSettings,
  updateAdminSettings,
  toPublicSettings,
};
