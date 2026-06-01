const express = require("express");
const router = express.Router();
const { authenticateToken, isAdmin } = require("../middleware/auth");
const { restrictBody } = require("../middleware/security");
const asyncHandler = require("../middleware/asyncHandler");
const blogController = require("../controllers/blogController");
const { uploadBlogImage } = require("../middleware/upload");

const BLOG_FIELDS = [
  "slug",
  "title",
  "excerpt",
  "content",
  "author",
  "category",
  "image_url",
  "read_time",
  "keywords",
  "featured",
  "is_published",
];

// Public reads
router.get("/", asyncHandler(blogController.getPosts));

// Admin list (defined before /:slug so it isn't captured as a slug)
router.get("/admin", authenticateToken, isAdmin, asyncHandler(blogController.getAllPosts));

// Blog cover image upload
router.post("/upload-image", authenticateToken, isAdmin, uploadBlogImage, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }
  return res.status(201).json({ imageUrl: req.file.url, filename: req.file.compressedFilename });
});

// Admin write
router.post(
  "/",
  authenticateToken,
  isAdmin,
  restrictBody(...BLOG_FIELDS),
  asyncHandler(blogController.createPost),
);

router.put(
  "/:id",
  authenticateToken,
  isAdmin,
  restrictBody(...BLOG_FIELDS),
  asyncHandler(blogController.updatePost),
);

router.delete("/:id", authenticateToken, isAdmin, asyncHandler(blogController.deletePost));

// Public single post by slug (kept last so the specific routes above win)
router.get("/:slug", asyncHandler(blogController.getPostBySlug));

module.exports = router;
