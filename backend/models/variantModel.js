const { dbPool } = require("../config/db");

const listByProduct = async (productId) => {
  const [rows] = await dbPool.query(
    `SELECT *
     FROM product_variants
     WHERE product_id = ? AND is_active = TRUE
     ORDER BY created_at ASC`,
    [productId],
  );

  return rows.map((variant) => ({
    ...variant,
    attributes:
      typeof variant.attributes === "string"
        ? JSON.parse(variant.attributes || "{}")
        : variant.attributes || {},
  }));
};

const listAttributesByProduct = async (productId) => {
  const [rows] = await dbPool.query(
    `SELECT *
     FROM variant_attributes
     WHERE product_id = ?
     ORDER BY display_order ASC, created_at ASC`,
    [productId],
  );

  return rows.map((entry) => ({
    ...entry,
    attribute_values:
      typeof entry.attribute_values === "string"
        ? JSON.parse(entry.attribute_values || "[]")
        : entry.attribute_values || [],
  }));
};

module.exports = {
  listByProduct,
  listAttributesByProduct,
};
