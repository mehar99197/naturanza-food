const { dbPool } = require("../config/db");

const listApprovedByProduct = async (productId) => {
  const [rows] = await dbPool.query(
    `SELECT r.*, u.name AS user_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = ? AND r.is_approved = TRUE
     ORDER BY r.created_at DESC`,
    [productId],
  );

  return rows;
};

const createReview = async ({ productId, userId, rating, comment }) => {
  const [result] = await dbPool.query(
    `INSERT INTO reviews (product_id, user_id, rating, comment, is_approved)
     VALUES (?, ?, ?, ?, FALSE)`,
    [productId, userId, rating, comment || null],
  );

  return result.insertId;
};

module.exports = {
  listApprovedByProduct,
  createReview,
};
