const express = require("express");
const router = express.Router();
const { authenticateToken, isAdmin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const categoryController = require("../controllers/categoryController");

router.get("/", asyncHandler(categoryController.getCategories));
router.get("/:id", asyncHandler(categoryController.getCategoryById));

router.post(
  "/",
  authenticateToken,
  isAdmin,
  asyncHandler(categoryController.createCategory),
);

router.put(
  "/:id",
  authenticateToken,
  isAdmin,
  asyncHandler(categoryController.updateCategory),
);

router.delete(
  "/:id",
  authenticateToken,
  isAdmin,
  asyncHandler(categoryController.deleteCategory),
);

module.exports = router;
