const express = require("express");
const router = express.Router();
const { authenticateToken, isAdmin } = require("../middleware/auth");
const { restrictBody } = require("../middleware/security");
const asyncHandler = require("../middleware/asyncHandler");
const productController = require("../controllers/productController");
const { uploadProductImage } = require("../middleware/upload");

router.get("/featured/list", asyncHandler(productController.getFeaturedProducts));
router.get("/", asyncHandler(productController.getProducts));
router.get("/:id", asyncHandler(productController.getProductById));

router.post(
  "/",
  authenticateToken,
  isAdmin,
  restrictBody('name', 'slug', 'price', 'description', 'category_id', 'image_url', 'gallery_images', 'stock_quantity', 'discount_percentage', 'is_active', 'is_featured', 'is_organic', 'ingredients', 'benefits', 'usage'),
  asyncHandler(productController.createProduct),
);

router.put(
  "/:id",
  authenticateToken,
  isAdmin,
  restrictBody('name', 'slug', 'price', 'description', 'category_id', 'image_url', 'gallery_images', 'stock_quantity', 'discount_percentage', 'is_active', 'is_featured', 'is_organic', 'ingredients', 'benefits', 'usage'),
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
  restrictBody('stock_quantity'),
  asyncHandler(productController.updateStock),
);

// Image upload endpoint
router.post(
  "/upload-image",
  authenticateToken,
  isAdmin,
  uploadProductImage,
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }
      
      return res.status(200).json({
        message: "Image uploaded successfully",
        imageUrl: req.file.url,
        filename: req.file.compressedFilename
      });
    } catch (error) {
      return res.status(500).json({ 
        error: "Failed to process upload",
        details: error.message 
      });
    }
  }
);

module.exports = router;
