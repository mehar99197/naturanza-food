const { dbPool } = require("../config/db");

const findById = async (orderId) => {
  const [rows] = await dbPool.query(
    "SELECT * FROM orders WHERE id = ? LIMIT 1",
    [orderId],
  );
  return rows[0] || null;
};

const listByUser = async (userId) => {
  const [rows] = await dbPool.query(
    `SELECT *
     FROM orders
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
};

const listItems = async (orderId) => {
  const [rows] = await dbPool.query(
    `SELECT oi.*, p.name, p.image_url
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [orderId],
  );

  return rows;
};

module.exports = {
  findById,
  listByUser,
  listItems,
};
