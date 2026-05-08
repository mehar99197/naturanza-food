const express = require("express");
const router = express.Router();
const { getAdminSettings, toPublicSettings } = require("../utils/adminSettings");

router.get("/", async (req, res) => {
  try {
    const settings = await getAdminSettings();
    res.json(toPublicSettings(settings));
  } catch (error) {
    res.status(500).json({ error: "Could not load settings" });
  }
});

module.exports = router;
