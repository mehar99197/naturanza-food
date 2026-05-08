const { dbPool } = require("../config/db");

const DEFAULT_ADMIN_SETTINGS = {
  storeName: process.env.BUSINESS_LEGAL_NAME || "Naturanza",
  storeEmail: process.env.BUSINESS_SUPPORT_EMAIL || "support@naturanza.com",
  storePhone: process.env.BUSINESS_SUPPORT_PHONE || "+92 (300) 123-4567",
  currency: "PKR",
  taxRate: 18,
  shippingFlat: 250,
  shippingFree: 5000,
  emailNotifications: true,
  orderNotifications: true,
  lowStockAlerts: true,
  lowStockThreshold: 10,
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
  updatedAt: row.updated_at || null,
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
      email_notifications, order_notifications, low_stock_alerts, low_stock_threshold)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    ],
  );

  const [nextRows] = await db.query(
    "SELECT * FROM admin_settings WHERE id = 1 LIMIT 1",
  );

  return normalizeSettingsRow(nextRows[0] || {});
};

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
      ? { currency: String(updates.currency || "").trim().toUpperCase() }
      : {}),
    ...(hasOwn("taxRate") ? { taxRate: toNumber(updates.taxRate, current.taxRate) } : {}),
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
  };

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
         low_stock_threshold = ?
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
  currency: settings.currency,
  taxRate: settings.taxRate,
  shippingFlat: settings.shippingFlat,
  shippingFree: settings.shippingFree,
  updatedAt: settings.updatedAt,
});

module.exports = {
  DEFAULT_ADMIN_SETTINGS,
  getAdminSettings,
  updateAdminSettings,
  toPublicSettings,
};
