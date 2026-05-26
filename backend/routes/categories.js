const express = require("express");
const router = express.Router();
const { authenticateToken, isAdmin } = require("../middleware/auth");
const { restrictBody } = require("../middleware/security");
const asyncHandler = require("../middleware/asyncHandler");
const categoryController = require("../controllers/categoryController");
const { uploadCategoryImage } = require("../middleware/upload");

router.get("/", asyncHandler(categoryController.getCategories));
router.get("/:id", asyncHandler(categoryController.getCategoryById));

router.post(
  "/",
  authenticateToken,
  isAdmin,
  restrictBody('name', 'slug', 'description', 'image_url', 'is_active', 'category_type'),
  asyncHandler(categoryController.createCategory),
);

router.put(
  "/:id",
  authenticateToken,
  isAdmin,
  restrictBody('name', 'slug', 'description', 'image_url', 'is_active', 'category_type'),
  asyncHandler(categoryController.updateCategory),
);

router.delete(
  "/:id",
  authenticateToken,
  isAdmin,
  asyncHandler(categoryController.deleteCategory),
);

// Image upload endpoint
router.post(
  "/upload-image",
  authenticateToken,
  isAdmin,
  uploadCategoryImage,
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
