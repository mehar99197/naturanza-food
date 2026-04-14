const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get user's cart
router.get('/', authenticateToken, (req, res) => {
    const query = `
        SELECT c.*, p.name, p.price, p.image_url, p.stock_quantity, p.discount_percentage,
        (p.price - (p.price * p.discount_percentage / 100)) as final_price,
        (c.quantity * (p.price - (p.price * p.discount_percentage / 100))) as subtotal
        FROM cart c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
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
router.post('/add', authenticateToken, (req, res) => {
    const { product_id, quantity } = req.body;
    
    if (!product_id || !quantity) {
        return res.status(400).json({ error: 'Product ID and quantity are required' });
    }
    
    // Check if product exists and has enough stock
    db.query('SELECT stock_quantity FROM products WHERE id = ?', [product_id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        if (results[0].stock_quantity < quantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }
        
        // Check if item already in cart
        db.query('SELECT * FROM cart WHERE user_id = ? AND product_id = ?', 
            [req.user.id, product_id], 
            (err, cartResults) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (cartResults.length > 0) {
                    // Update quantity
                    const newQuantity = cartResults[0].quantity + quantity;
                    db.query('UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?',
                        [newQuantity, req.user.id, product_id],
                        (err, result) => {
                            if (err) {
                                return res.status(500).json({ error: 'Error updating cart' });
                            }
                            res.json({ message: 'Cart updated successfully' });
                        }
                    );
                } else {
                    // Insert new item
                    db.query('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
                        [req.user.id, product_id, quantity],
                        (err, result) => {
                            if (err) {
                                return res.status(500).json({ error: 'Error adding to cart' });
                            }
                            res.status(201).json({ message: 'Item added to cart' });
                        }
                    );
                }
            }
        );
    });
});

// Update cart item quantity
router.put('/update/:product_id', authenticateToken, (req, res) => {
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
        return res.status(400).json({ error: 'Valid quantity is required' });
    }
    
    // Check stock availability
    db.query('SELECT stock_quantity FROM products WHERE id = ?', [req.params.product_id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        if (results[0].stock_quantity < quantity) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }
        
        db.query('UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?',
            [quantity, req.user.id, req.params.product_id],
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
