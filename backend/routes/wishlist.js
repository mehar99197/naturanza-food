const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");

const toProductId = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getWishlistItems = async (userId) => {
    const [rows] = await db.promise().query(
        `SELECT
                w.id,
                w.user_id,
                w.product_id,
                w.added_at,
                p.name,
                p.price,
                p.image_url,
                p.description,
                p.stock_quantity,
                p.discount_percentage,
                c.name AS category_name,
                c.id AS category_id
         FROM user_wishlist w
         JOIN products p ON w.product_id = p.id
         LEFT JOIN categories c ON p.category_id = c.id
         WHERE w.user_id = ?
         ORDER BY w.added_at DESC`,
        [userId],
    );

    return rows;
};

// GET /api/wishlist
router.get("/", authenticateToken, async (req, res) => {
    try {
        const rows = await getWishlistItems(req.user.id);
        res.json({
            items: rows,
            totalItems: rows.length,
        });
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

// POST /api/wishlist/add
router.post("/add", authenticateToken, async (req, res) => {
    try {
        const productId = toProductId(req.body?.product_id);

        if (!productId) {
            return res.status(400).json({ error: "Product ID is required" });
        }

        const [products] = await db
            .promise()
            .query("SELECT id FROM products WHERE id = ? LIMIT 1", [productId]);

        if (!products.length) {
            return res.status(404).json({ error: "Product not found" });
        }

        const [result] = await db
            .promise()
            .query("INSERT INTO user_wishlist (user_id, product_id) VALUES (?, ?)", [
                req.user.id,
                productId,
            ]);

        res.status(201).json({
            message: "Product added to wishlist",
            id: result.insertId,
            product_id: productId,
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ error: "Product already in wishlist" });
        }

        res.status(500).json({ error: "Error adding to wishlist" });
    }
});

const removeWishlistItem = async (req, res, productIdInput) => {
    const productId = toProductId(productIdInput);

    if (!productId) {
        return res.status(400).json({ error: "Invalid product id" });
    }

    try {
        const [result] = await db
            .promise()
            .query("DELETE FROM user_wishlist WHERE user_id = ? AND product_id = ?", [
                req.user.id,
                productId,
            ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Item not found in wishlist" });
        }

        return res.json({ message: "Item removed from wishlist" });
    } catch (error) {
        return res.status(500).json({ error: "Database error" });
    }
};

// DELETE /api/wishlist/remove/:productId
router.delete("/remove/:productId", authenticateToken, async (req, res) => {
    return removeWishlistItem(req, res, req.params.productId);
});

// Backward compatibility with existing frontend remove call.
router.delete("/:product_id", authenticateToken, async (req, res) => {
    return removeWishlistItem(req, res, req.params.product_id);
});

router.get("/check/:product_id", authenticateToken, async (req, res) => {
    const productId = toProductId(req.params.product_id);

    if (!productId) {
        return res.status(400).json({ error: "Invalid product id" });
    }

    try {
        const [rows] = await db
            .promise()
            .query("SELECT id FROM user_wishlist WHERE user_id = ? AND product_id = ?", [
                req.user.id,
                productId,
            ]);

        res.json({ isInWishlist: rows.length > 0 });
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

router.delete("/", authenticateToken, async (req, res) => {
    try {
        const [result] = await db
            .promise()
            .query("DELETE FROM user_wishlist WHERE user_id = ?", [req.user.id]);

        res.json({
            message: "Wishlist cleared",
            deletedItems: result.affectedRows,
        });
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

module.exports = router;
