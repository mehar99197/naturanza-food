const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { authenticateToken } = require("../middleware/auth");
const { restrictBody } = require("../middleware/security");
const profileSecurityController = require("../controllers/profileSecurityController");

const router = express.Router();

router.put(
  "/change-password",
  authenticateToken,
  restrictBody('currentPassword', 'newPassword', 'confirmNewPassword'),
  asyncHandler(profileSecurityController.changePassword),
);

router.get(
  "/login-history",
  authenticateToken,
  asyncHandler(profileSecurityController.getLoginHistory),
);

router.get(
  "/active-sessions",
  authenticateToken,
  asyncHandler(profileSecurityController.getActiveSessions),
);

router.post(
  "/logout-device/:sessionId",
  authenticateToken,
  restrictBody(),
  asyncHandler(profileSecurityController.logoutDevice),
);

router.post(
  "/logout-all-other-devices",
  authenticateToken,
  restrictBody(),
  asyncHandler(profileSecurityController.logoutAllOtherDevices),
);

router.delete(
  "/delete-account",
  authenticateToken,
  restrictBody('confirmationText', 'currentPassword'),
  asyncHandler(profileSecurityController.deleteAccount),
);

module.exports = router;
