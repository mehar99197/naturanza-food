const express = require("express");
const { rateLimit } = require("express-rate-limit");
const router = express.Router();
const { restrictBody } = require("../middleware/security");
const asyncHandler = require("../middleware/asyncHandler");
const newsletterController = require("../controllers/newsletterController");

// Stop spammers from hammering the public subscribe endpoint with random
// emails; 5 per 15 minutes per IP is generous for a real user.
const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many subscribe attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/subscribe",
  subscribeLimiter,
  restrictBody("email", "source"),
  asyncHandler(newsletterController.subscribe),
);

router.get(
  "/unsubscribe/:token",
  asyncHandler(newsletterController.unsubscribe),
);

// Some email clients (Gmail/Yahoo) do a one-click POST via the
// List-Unsubscribe-Post header before falling back to the GET link.
router.post(
  "/unsubscribe/:token",
  asyncHandler(newsletterController.unsubscribe),
);

module.exports = router;
