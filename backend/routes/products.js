const express = require("express");
const router = express.Router();
const { authenticateToken, isAdmin } = require("../middleware/auth");
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
      console.error('Upload endpoint error:', error);
      return res.status(500).json({ 
        error: "Failed to process upload",
        details: error.message 
      });
    }
  }
);

module.exports = router;
