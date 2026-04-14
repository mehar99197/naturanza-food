const { dbPool } = require("../config/db");

const listActive = async () => {
  const [rows] = await dbPool.query(
    "SELECT * FROM coupons WHERE is_active = TRUE ORDER BY created_at DESC",
  );
  return rows;
};

const findByCode = async (code) => {
  const [rows] = await dbPool.query(
    "SELECT * FROM coupons WHERE code = ? LIMIT 1",
    [String(code || "").trim().toUpperCase()],
  );
  return rows[0] || null;
};

module.exports = {
  listActive,
  findByCode,
};
