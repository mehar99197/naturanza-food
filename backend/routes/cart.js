const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { restrictBody } = require('../middleware/security');
const { db } = require('../config/db');

// Get user's cart
router.get('/', authenticateToken, (req, res) => {
    const query = `
        SELECT c.*, p.name, p.price, p.image_url, p.stock_quantity, p.reserved_stock, p.discount_percentage,
        (p.price - (p.price * p.discount_percentage / 100)) as final_price,
        (c.quantity * (p.price - (p.price * p.discount_percentage / 100))) as subtotal
        FROM cart c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ? AND p.is_active = TRUE AND p.deleted_at IS NULL
    `;
    
    db.query(query, [req.user.id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        const total = results.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
        
        res.json({
            items: results,
            total: total.toFixed(2)
        });
    });
});

// Add item to cart
router.post('/add', authenticateToken, restrictBody('product_id', 'quantity'), async (req, res) => {
    const { product_id, quantity } = req.body;

    const parsedProductId = parseInt(product_id, 10);
    const parsedQuantity = parseInt(quantity, 10);
    if (!Number.isInteger(parsedProductId) || parsedProductId < 1 || !Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
        return res.status(400).json({ error: 'Product ID and a valid quantity (integer >= 1) are required' });
    }

    const connection = await db.promise().getConnection();
    try {
        await connection.beginTransaction();

        const [results] = await connection.query(
            'SELECT is_active, stock_quantity, reserved_stock FROM products WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
            [parsedProductId],
        );

        if (results.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Product not found' });
        }

        if (!results[0].is_active) {
            await connection.rollback();
            return res.status(404).json({ error: 'Product is no longer available' });
        }

        const availableStock = Number(results[0].stock_quantity || 0) - Number(results[0].reserved_stock || 0);
        if (availableStock < parsedQuantity) {
            await connection.rollback();
            return res.status(400).json({ error: 'Insufficient stock' });
        }

        const [cartResults] = await connection.query(
            'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ? FOR UPDATE',
            [req.user.id, parsedProductId],
        );

        if (cartResults.length > 0) {
            const newQuantity = Number(cartResults[0].quantity || 0) + parsedQuantity;
            if (newQuantity > availableStock) {
                await connection.rollback();
                return res.status(400).json({ error: 'Insufficient stock' });
            }
            await connection.query(
                'UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?',
                [newQuantity, req.user.id, parsedProductId],
            );
            await connection.commit();
            return res.json({ message: 'Cart updated successfully' });
        }

        await connection.query(
            'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
            [req.user.id, parsedProductId, parsedQuantity],
        );
        await connection.commit();
        return res.status(201).json({ message: 'Item added to cart' });
    } catch (error) {
        await connection.rollback().catch(() => {});
        return res.status(500).json({ error: 'Error adding to cart' });
    } finally {
        connection.release();
    }
});

// Update cart item quantity
router.put('/update/:product_id', authenticateToken, restrictBody('quantity'), (req, res) => {
    const { quantity } = req.body;

    const parsedQuantity = parseInt(quantity, 10);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
        return res.status(400).json({ error: 'Valid quantity (integer >= 1) is required' });
    }
    
    // Check stock availability
    db.query('SELECT is_active, stock_quantity, reserved_stock FROM products WHERE id = ? AND deleted_at IS NULL', [req.params.product_id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        if (!results[0].is_active) {
            return res.status(404).json({ error: 'Product is no longer available' });
        }

        const availableStock = Number(results[0].stock_quantity || 0) - Number(results[0].reserved_stock || 0);
        if (availableStock < parsedQuantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }

        db.query('UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?',
            [parsedQuantity, req.user.id, req.params.product_id],
            (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Error updating cart' });
                }
                
                if (result.affectedRows === 0) {
                    return res.status(404).json({ error: 'Item not in cart' });
                }
                
                res.json({ message: 'Cart updated successfully' });
            }
        );
    });
});

// Remove item from cart
router.delete('/remove/:product_id', authenticateToken, (req, res) => {
    db.query('DELETE FROM cart WHERE user_id = ? AND product_id = ?',
        [req.user.id, req.params.product_id],
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Error removing from cart' });
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Item not in cart' });
            }
            
            res.json({ message: 'Item removed from cart' });
        }
    );
});

// Clear cart
router.delete('/clear', authenticateToken, (req, res) => {
    db.query('DELETE FROM cart WHERE user_id = ?', [req.user.id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error clearing cart' });
        }
        
        res.json({ message: 'Cart cleared successfully' });
    });
});

module.exports = router;
