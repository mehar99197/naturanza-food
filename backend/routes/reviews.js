const express = require('express');
const router = express.Router();
const { db } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// POST - Submit a new review (authenticated users only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { product_id, rating, comment } = req.body;
    const user_id = req.user.id;

    // Validation
    if (!product_id || !rating) {
      return res.status(400).json({ error: 'Product ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if product exists
    const [product] = await db.promise().query(
      'SELECT id FROM products WHERE id = ?',
      [product_id]
    );

    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if user already reviewed this product
    const [existing] = await db.promise().query(
      'SELECT id FROM reviews WHERE user_id = ? AND product_id = ?',
      [user_id, product_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }

    // Insert review — auto-approved
    const [result] = await db.promise().query(
      `INSERT INTO reviews (user_id, product_id, rating, comment, is_approved, created_at) 
       VALUES (?, ?, ?, ?, 1, NOW())`,
      [user_id, product_id, rating, comment || null]
    );

    // Get the created review with user and product details
    const [newReview] = await db.promise().query(
      `SELECT 
        r.id,
        r.user_id,
        r.product_id,
        r.rating,
        r.comment,
        r.is_approved,
        r.created_at,
        u.name AS customer_name,
        u.email AS customer_email,
        u.profile_image AS customer_image,
        p.name AS product_name
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       JOIN products p ON p.id = r.product_id
       WHERE r.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: 'Review submitted successfully!',
      review: newReview[0]
    });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// GET - Get reviews for a specific product (only approved reviews for non-admin)
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    const [reviews] = await db.promise().query(
      `SELECT 
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        u.name AS customer_name,
        u.profile_image AS customer_image
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ? AND r.is_approved = 1
       ORDER BY r.created_at DESC`,
      [productId]
    );

    res.json(reviews);
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// GET - Get user's own reviews
router.get('/my-reviews', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [reviews] = await db.promise().query(
      `SELECT 
        r.id,
        r.product_id,
        r.rating,
        r.comment,
        r.is_approved,
        r.created_at,
        p.name AS product_name,
        p.image AS product_image
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [userId]
    );

    res.json(reviews);
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch your reviews' });
  }
});

module.exports = router;
