const express = require("express");
const router = express.Router();
const { authenticateToken, isAdmin } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");
const productController = require("../controllers/productController");

router.get("/featured/list", asyncHandler(productController.getFeaturedProducts));
router.get("/", asyncHandler(productController.getProducts));
router.get("/:id", asyncHandler(productController.getProductById));

router.post(
  "/",
  authenticateToken,
  isAdmin,
  asyncHandler(productController.createProduct),
);

router.put(
  "/:id",
  authenticateToken,
  isAdmin,
  asyncHandler(productController.updateProduct),
);

router.delete(
  "/:id",
  authenticateToken,
  isAdmin,
  asyncHandler(productController.deleteProduct),
);

router.patch(
  "/:id/stock",
  authenticateToken,
  isAdmin,
  asyncHandler(productController.updateStock),
);

module.exports = router;
