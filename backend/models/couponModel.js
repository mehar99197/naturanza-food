const { dbPool } = require("../config/db");

const normalizeCode = (code) => String(code || "").trim().toUpperCase();

const listActive = async () => {
  const [rows] = await dbPool.query(
    "SELECT * FROM coupons WHERE is_active = TRUE ORDER BY created_at DESC",
  );
  return rows;
};

const findByCode = async (code) => {
  const [rows] = await dbPool.query(
    "SELECT * FROM coupons WHERE code = ? LIMIT 1",
    [normalizeCode(code)],
  );
  return rows[0] || null;
};

/**
 * Insert a coupon with the given code and defaults, but only if no coupon with
 * that code already exists. Returns { coupon, created }. Never overwrites an
 * existing coupon — admin owns its details once it exists.
 */
const ensureCoupon = async (code, defaults = {}) => {
  const normalized = normalizeCode(code);
  if (!normalized) {
    return { coupon: null, created: false };
  }

  const existing = await findByCode(normalized);
  if (existing) {
    return { coupon: existing, created: false };
  }

  const discountType = defaults.discount_type === "fixed" ? "fixed" : "percentage";
  const discountValue = Number(defaults.discount_value);
  const safeValue =
    Number.isFinite(discountValue) && discountValue > 0 ? discountValue : 10;

  await dbPool.query(
    `INSERT INTO coupons
       (code, description, discount_type, discount_value,
        min_order_amount, max_discount, usage_limit, expiry_date, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
    [
      normalized,
      defaults.description || "Welcome offer for newsletter subscribers",
      discountType,
      safeValue,
      Number(defaults.min_order_amount) || 0,
      defaults.max_discount != null ? Number(defaults.max_discount) : null,
      defaults.usage_limit != null ? Number(defaults.usage_limit) : null,
      defaults.expiry_date || null,
    ],
  );

  const created = await findByCode(normalized);
  return { coupon: created, created: true };
};

module.exports = {
  listActive,
  findByCode,
  ensureCoupon,
};
