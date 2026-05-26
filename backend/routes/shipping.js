const express = require("express");
const router = express.Router();
const { dbPool } = require("../config/db");

// GET /api/shipping/city-fees/active - public, active cities only
router.get("/city-fees/active", async (req, res) => {
  try {
    const [cities] = await dbPool.query(
      `SELECT id, city_name, fee
       FROM city_delivery_fees
       WHERE is_active = TRUE
       ORDER BY city_name ASC`,
    );
    res.json(cities);
  } catch (error) {
    res.status(500).json({ error: "Could not fetch shipping cities" });
  }
});

module.exports = router;