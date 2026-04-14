const { dbPool } = require("../config/db");

const listByUser = async (userId) => {
  const [rows] = await dbPool.query(
    `SELECT c.*, p.name, p.price, p.image_url, p.stock_quantity, p.discount_percentage,
            (p.price - (p.price * p.discount_percentage / 100)) AS final_price,
            (c.quantity * (p.price - (p.price * p.discount_percentage / 100))) AS subtotal
     FROM cart c
     JOIN products p ON p.id = c.product_id
     WHERE c.user_id = ?`,
    [userId],
  );

  return rows;
};

const upsertItem = async ({ userId, productId, quantity }) => {
  const [existing] = await dbPool.query(
    "SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ? LIMIT 1",
    [userId, productId],
  );

  if (existing.length > 0) {
    await dbPool.query("UPDATE cart SET quantity = ? WHERE id = ?", [
      Number(existing[0].quantity) + Number(quantity),
      existing[0].id,
    ]);
    return "updated";
  }

  await dbPool.query(
    "INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)",
    [userId, productId, quantity],
  );
  return "created";
};

module.exports = {
  listByUser,
  upsertItem,
};
