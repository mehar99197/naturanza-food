const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Get database connection from global
const getDb = () => global.db;

// Get all variants for a product
router.get('/product/:productId', (req, res) => {
    const { productId } = req.params;
    const db = getDb();

    const query = `
        SELECT * FROM product_variants 
        WHERE product_id = ? AND is_active = TRUE
        ORDER BY variant_name ASC
    `;

    db.query(query, [productId], (err, results) => {
        if (err) {
            console.error('Error fetching variants:', err);
            return res.status(500).json({ error: 'Failed to fetch variants' });
        }

        // Parse JSON attributes
        const variants = results.map(variant => ({
            ...variant,
            attributes: typeof variant.attributes === 'string' 
                ? JSON.parse(variant.attributes) 
                : variant.attributes
        }));

        res.json({ data: variants });
    });
});

// Get variant attributes for a product
router.get('/attributes/:productId', (req, res) => {
    const { productId } = req.params;
    const db = getDb();

    const query = `
        SELECT * FROM variant_attributes 
        WHERE product_id = ?
        ORDER BY display_order ASC, attribute_name ASC
    `;

    db.query(query, [productId], (err, results) => {
        if (err) {
            console.error('Error fetching variant attributes:', err);
            return res.status(500).json({ error: 'Failed to fetch variant attributes' });
        }

        // Parse JSON values
        const attributes = results.map(attr => ({
            ...attr,
            attribute_values: typeof attr.attribute_values === 'string'
                ? JSON.parse(attr.attribute_values)
                : attr.attribute_values
        }));

        res.json({ data: attributes });
    });
});

// Create a new variant (Admin only)
router.post('/product/:productId', authenticateToken, isAdmin, (req, res) => {
    const { productId } = req.params;
    const { variant_name, sku, price, stock_quantity, attributes, image_url } = req.body;

    if (!variant_name || !sku) {
        return res.status(400).json({ error: 'Variant name and SKU are required' });
    }

    const db = getDb();
    const query = `
        INSERT INTO product_variants 
        (product_id, variant_name, sku, price, stock_quantity, attributes, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const attributesJson = JSON.stringify(attributes || {});

    db.query(
        query, 
        [productId, variant_name, sku, price, stock_quantity || 0, attributesJson, image_url],
        (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'SKU already exists' });
                }
                console.error('Error creating variant:', err);
                return res.status(500).json({ error: 'Failed to create variant' });
            }

            res.status(201).json({ 
                message: 'Variant created successfully',
                variantId: result.insertId 
            });
        }
    );
});

// Update a variant (Admin only)
router.put('/:variantId', authenticateToken, isAdmin, (req, res) => {
    const { variantId } = req.params;
    const { variant_name, sku, price, stock_quantity, attributes, image_url, is_active } = req.body;

    const updates = [];
    const values = [];

    if (variant_name !== undefined) {
        updates.push('variant_name = ?');
        values.push(variant_name);
    }
    if (sku !== undefined) {
        updates.push('sku = ?');
        values.push(sku);
    }
    if (price !== undefined) {
        updates.push('price = ?');
        values.push(price);
    }
    if (stock_quantity !== undefined) {
        updates.push('stock_quantity = ?');
        values.push(stock_quantity);
    }
    if (attributes !== undefined) {
        updates.push('attributes = ?');
        values.push(JSON.stringify(attributes));
    }
    if (image_url !== undefined) {
        updates.push('image_url = ?');
        values.push(image_url);
    }
    if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(variantId);

    const db = getDb();
    const query = `UPDATE product_variants SET ${updates.join(', ')} WHERE id = ?`;

    db.query(query, values, (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'SKU already exists' });
            }
            console.error('Error updating variant:', err);
            return res.status(500).json({ error: 'Failed to update variant' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Variant not found' });
        }

        res.json({ message: 'Variant updated successfully' });
    });
});

// Delete a variant (Admin only)
router.delete('/:variantId', authenticateToken, isAdmin, (req, res) => {
    const { variantId } = req.params;
    const db = getDb();

    const query = 'DELETE FROM product_variants WHERE id = ?';

    db.query(query, [variantId], (err, result) => {
        if (err) {
            console.error('Error deleting variant:', err);
            return res.status(500).json({ error: 'Failed to delete variant' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Variant not found' });
        }

        res.json({ message: 'Variant deleted successfully' });
    });
});

// Set variant attributes for a product (Admin only)
router.post('/attributes/:productId', authenticateToken, isAdmin, (req, res) => {
    const { productId } = req.params;
    const { attribute_name, attribute_values, display_order } = req.body;

    if (!attribute_name || !attribute_values || !Array.isArray(attribute_values)) {
        return res.status(400).json({ error: 'Attribute name and values array are required' });
    }

    const db = getDb();
    const query = `
        INSERT INTO variant_attributes 
        (product_id, attribute_name, attribute_values, display_order)
        VALUES (?, ?, ?, ?)
    `;

    const valuesJson = JSON.stringify(attribute_values);

    db.query(query, [productId, attribute_name, valuesJson, display_order || 0], (err, result) => {
        if (err) {
            console.error('Error creating variant attribute:', err);
            return res.status(500).json({ error: 'Failed to create variant attribute' });
        }

        res.status(201).json({ 
            message: 'Variant attribute created successfully',
            attributeId: result.insertId 
        });
    });
});

module.exports = router;
