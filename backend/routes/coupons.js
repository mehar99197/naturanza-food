const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { restrictBody } = require('../middleware/security');
const { db } = require('../config/db');

const VALID_DISCOUNT_TYPES = new Set(['percentage', 'fixed']);

// Get all coupons (Admin only)
router.get('/', authenticateToken, isAdmin, (req, res) => {
    const query = 'SELECT * FROM coupons ORDER BY created_at DESC';
    
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Get active coupons (Public - used during checkout)
router.get('/active', (req, res) => {
    const query = `
        SELECT id, code, description, discount_type, discount_value, min_order_amount, max_discount, expiry_date
        FROM coupons
        WHERE is_active = TRUE
        AND (expiry_date IS NULL OR expiry_date > NOW())
        AND (usage_limit IS NULL OR used_count < usage_limit)
        ORDER BY created_at DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Get coupon by ID (Admin only)
router.get('/:id', authenticateToken, isAdmin, (req, res) => {
    db.query('SELECT * FROM coupons WHERE id = ?', [req.params.id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Coupon not found' });
        }
        
        res.json(results[0]);
    });
});

// Validate coupon (Public - used during checkout)
router.post('/validate', restrictBody('code', 'orderAmount'), (req, res) => {
    const { code, orderAmount } = req.body;
    
    if (!code || !orderAmount) {
        return res.status(400).json({ error: 'Code and order amount are required' });
    }
    
    const query = `
        SELECT * FROM coupons 
        WHERE code = ? 
        AND is_active = TRUE 
        AND (expiry_date IS NULL OR expiry_date > NOW())
    `;
    
    db.query(query, [code.trim().toUpperCase()], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Invalid or expired coupon code' });
        }
        
        const coupon = results[0];
        
        // Check if usage limit reached
        if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
            return res.status(400).json({ error: 'Coupon usage limit reached' });
        }
        
        // Check minimum order amount
        if (coupon.min_order_amount && orderAmount < coupon.min_order_amount) {
            return res.status(400).json({ 
                error: `Minimum order amount of ${coupon.min_order_amount} required` 
            });
        }
        
        // Calculate discount
        let discountAmount = 0;
        if (coupon.discount_type === 'percentage') {
            discountAmount = (orderAmount * coupon.discount_value) / 100;
            if (coupon.max_discount && discountAmount > coupon.max_discount) {
                discountAmount = coupon.max_discount;
            }
        } else {
            discountAmount = coupon.discount_value;
        }
        
        res.json({
            valid: true,
            coupon: {
                id: coupon.id,
                code: coupon.code,
                discount_type: coupon.discount_type,
                discount_value: coupon.discount_value,
                discount_amount: discountAmount,
                description: coupon.description
            }
        });
    });
});

// Create coupon (Admin only)
router.post('/', authenticateToken, isAdmin, restrictBody('code', 'description', 'discount_type', 'discount_value', 'min_order_amount', 'max_discount', 'usage_limit', 'expiry_date'), (req, res) => {
    const { 
        code, description, discount_type, discount_value, 
        min_order_amount, max_discount, usage_limit, expiry_date 
    } = req.body;
    
    if (!code || !discount_value) {
        return res.status(400).json({ error: 'Code and discount value are required' });
    }

    const normalizedDiscountType = String(discount_type || 'percentage').trim().toLowerCase();
    if (!VALID_DISCOUNT_TYPES.has(normalizedDiscountType)) {
        return res.status(400).json({ error: 'discount_type must be "percentage" or "fixed"' });
    }
    
    const query = `
        INSERT INTO coupons 
        (code, description, discount_type, discount_value, min_order_amount, max_discount, usage_limit, expiry_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(query, [
        code.trim().toUpperCase(), 
        description, 
        discount_type || 'percentage', 
        discount_value,
        min_order_amount || 0,
        max_discount || null,
        usage_limit || null,
        expiry_date || null
    ], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Coupon code already exists' });
            }
            return res.status(500).json({ error: 'Error creating coupon' });
        }
        
        res.status(201).json({ 
            message: 'Coupon created successfully',
            couponId: result.insertId,
            coupon: {
                id: result.insertId,
                code: code.trim().toUpperCase(),
                description,
                discount_type: discount_type || 'percentage',
                discount_value,
                min_order_amount: min_order_amount || 0,
                max_discount: max_discount || null,
                usage_limit: usage_limit || null,
                expiry_date: expiry_date || null,
                is_active: true,
                used_count: 0
            }
        });
    });
});

// Update coupon (Admin only)
router.put('/:id', authenticateToken, isAdmin, restrictBody('code', 'description', 'discount_type', 'discount_value', 'min_order_amount', 'max_discount', 'usage_limit', 'expiry_date', 'is_active'), (req, res) => {
    const { 
        code, description, discount_type, discount_value, 
        min_order_amount, max_discount, usage_limit, expiry_date, is_active 
    } = req.body;
    
    const query = `
        UPDATE coupons SET 
        code = ?, description = ?, discount_type = ?, discount_value = ?, 
        min_order_amount = ?, max_discount = ?, usage_limit = ?, expiry_date = ?, is_active = ?
        WHERE id = ?
    `;
    
    db.query(query, [
        code.trim().toUpperCase(), 
        description, 
        discount_type, 
        discount_value,
        min_order_amount,
        max_discount,
        usage_limit,
        expiry_date,
        is_active !== undefined ? is_active : true,
        req.params.id
    ], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Coupon code already exists' });
            }
            return res.status(500).json({ error: 'Error updating coupon' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Coupon not found' });
        }
        
        res.json({ message: 'Coupon updated successfully' });
    });
});

// Delete coupon (Admin only)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
    db.query('DELETE FROM coupons WHERE id = ?', [req.params.id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error deleting coupon' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Coupon not found' });
        }
        
        res.json({ message: 'Coupon deleted successfully' });
    });
});

// Toggle coupon status (Admin only)
router.patch('/:id/toggle', authenticateToken, isAdmin, (req, res) => {
    db.query('UPDATE coupons SET is_active = NOT is_active WHERE id = ?', 
        [req.params.id], 
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Error toggling coupon status' });
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Coupon not found' });
            }
            
            res.json({ message: 'Coupon status toggled successfully' });
        }
    );
});

// Increment usage count — Admin only.
// NOTE: In normal flow, coupon usage is incremented inside the order creation transaction.
// This endpoint exists only for manual admin correction.
router.post('/:id/use', authenticateToken, isAdmin, (req, res) => {
    db.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', 
        [req.params.id], 
        (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Error updating coupon usage' });
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: 'Coupon not found' });
            }
            
            res.json({ message: 'Coupon usage updated' });
        }
    );
});

module.exports = router;
