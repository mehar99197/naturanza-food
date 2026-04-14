const { dbPool } = require("../config/db");

const listByUser = async (userId) => {
  const [rows] = await dbPool.query(
    `SELECT w.*, p.name, p.price, p.image_url, p.discount_percentage
     FROM wishlist w
     JOIN products p ON p.id = w.product_id
     WHERE w.user_id = ?
     ORDER BY w.created_at DESC`,
    [userId],
  );

  return rows;
};

const add = async ({ userId, productId }) => {
  await dbPool.query(
    `INSERT INTO wishlist (user_id, product_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
    [userId, productId],
  );
};

const remove = async ({ userId, productId }) => {
  const [result] = await dbPool.query(
    "DELETE FROM wishlist WHERE user_id = ? AND product_id = ?",
    [userId, productId],
  );

  return result.affectedRows > 0;
};

module.exports = {
  listByUser,
  add,
  remove,
};
