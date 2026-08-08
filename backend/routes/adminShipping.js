const express = require("express");
const router = express.Router();
const { dbPool } = require("../config/db");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(isAdmin);
router.use(requirePermission("manage_shipping_cities"));

const parseFee = (value) => {
  const fee = Number(value);
  return Number.isFinite(fee) && fee >= 0 ? Math.round(fee) : null;
};

// GET /api/admin/shipping/city-fees - fetch all cities
router.get("/city-fees", async (req, res) => {
  try {
    const [cities] = await dbPool.query(
      `SELECT id, city_name, fee, is_active
       FROM city_delivery_fees
       ORDER BY city_name ASC`,
    );
    res.json(cities);
  } catch (error) {
    res.status(500).json({ error: "Could not fetch shipping cities" });
  }
});

// POST /api/admin/shipping/city-fees - create city
router.post("/city-fees", async (req, res) => {
  try {
    const { city_name, fee = 0, is_active = true } = req.body;
    const parsedFee = parseFee(fee);

    if (!city_name || typeof city_name !== "string" || !city_name.trim()) {
      return res.status(400).json({ error: "City name is required" });
    }
    if (parsedFee === null) {
      return res.status(400).json({ error: "Fee must be a non-negative number" });
    }

    const [result] = await dbPool.query(
      `INSERT INTO city_delivery_fees (city_name, fee, is_active)
       VALUES (?, ?, ?)`,
       [city_name.trim(), parsedFee, Boolean(is_active)],
    );

    res.status(201).json({
      id: result.insertId,
      city_name: city_name.trim(),
       fee: parsedFee,
      is_active: Boolean(is_active),
    });
  } catch (error) {
    res.status(500).json({ error: "Could not create shipping city" });
  }
});

// PUT /api/admin/shipping/city-fees/:id - update city
router.put("/city-fees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { city_name, fee, is_active } = req.body;

    const updates = [];
    const values = [];

    if (city_name !== undefined) {
      if (!city_name || typeof city_name !== "string" || !city_name.trim()) {
        return res.status(400).json({ error: "City name cannot be empty" });
      }
      updates.push("city_name = ?");
      values.push(city_name.trim());
    }

    if (fee !== undefined) {
      const parsedFee = parseFee(fee);
      if (parsedFee === null) {
        return res.status(400).json({ error: "Fee must be a non-negative number" });
      }
      updates.push("fee = ?");
      values.push(parsedFee);
    }

    if (is_active !== undefined) {
      updates.push("is_active = ?");
      values.push(Boolean(is_active));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);
    await dbPool.query(
      `UPDATE city_delivery_fees SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );

    const [cities] = await dbPool.query(
      `SELECT id, city_name, fee, is_active
       FROM city_delivery_fees WHERE id = ?`,
      [id],
    );

    res.json(cities[0] || null);
  } catch (error) {
    res.status(500).json({ error: "Could not update shipping city" });
  }
});

// DELETE /api/admin/shipping/city-fees/:id - delete city
router.delete("/city-fees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await dbPool.query("DELETE FROM city_delivery_fees WHERE id = ?", [id]);
    res.json({ message: "City deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Could not delete shipping city" });
  }
});

module.exports = router;
