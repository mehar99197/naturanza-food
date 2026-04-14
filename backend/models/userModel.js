const { dbPool } = require("../config/db");

const findById = async (userId) => {
  const [rows] = await dbPool.query(
    "SELECT id, name, email, phone, role, is_active, profile_image, created_at, updated_at FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  return rows[0] || null;
};

const findByEmail = async (email) => {
  const [rows] = await dbPool.query(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  return rows[0] || null;
};

const listActiveUsers = async ({ limit = 100, offset = 0 } = {}) => {
  const [rows] = await dbPool.query(
    `SELECT id, name, email, phone, role, is_active, created_at
     FROM users
     WHERE is_active = TRUE
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [Number(limit), Number(offset)],
  );

  return rows;
};

module.exports = {
  findById,
  findByEmail,
  listActiveUsers,
};
