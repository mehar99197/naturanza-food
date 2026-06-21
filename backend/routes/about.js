const express = require("express");
const router = express.Router();
const { getAboutContent } = require("../utils/aboutContent");

// Public: the storefront About page reads its content here.
router.get("/", async (req, res) => {
  try {
    const content = await getAboutContent();
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: "Could not load About content" });
  }
});

module.exports = router;
