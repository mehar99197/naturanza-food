const express = require("express");
const {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  validateBody,
} = require("./auth.schemas");
const { register, login, refreshToken, logout } = require("./auth.controller");
const { protect } = require("../../middlewares/auth");
const { authLimiter, refreshLimiter } = require("../../middlewares/security");

const router = express.Router();

// Mounted under /api/auth by the main router/app.
router.post("/register", authLimiter, validateBody(registerSchema), register);
router.post("/login", authLimiter, validateBody(loginSchema), login);
router.post(
  "/refresh-token",
  refreshLimiter,
  validateBody(refreshTokenSchema),
  refreshToken,
);
router.post("/logout", protect, logout);

module.exports = {
  authRouter: router,
};
