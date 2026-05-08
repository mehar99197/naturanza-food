const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { db } = require('../config/db');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Submit contact form
router.post('/', (req, res) => {
    const name    = String(req.body?.name    || '').trim().slice(0, 100);
    const email   = String(req.body?.email   || '').trim().toLowerCase().slice(0, 200);
    const phone   = String(req.body?.phone   || '').trim().slice(0, 30)  || null;
    const subject = String(req.body?.subject || '').trim().slice(0, 200) || null;
    const message = String(req.body?.message || '').trim().slice(0, 5000);

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    const query = 'INSERT INTO contacts (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)';

    db.query(query, [name, email, phone, subject, message], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error submitting contact form' });
        }

        db.query("SELECT id FROM users WHERE role = 'admin'", (adminErr, adminRows) => {
            if (!adminErr && Array.isArray(adminRows) && adminRows.length > 0) {
                const notificationValues = adminRows.map((adminRow) => [
                    adminRow.id,
                    'admin_contact_created',
                    'New Customer Message',
                    `A new contact inquiry was submitted by ${name}.`,
                    JSON.stringify({
                        contact_id: result.insertId,
                        name,
                        email,
                        subject: subject || null,
                    }),
                ]);

                db.query(
                    `INSERT INTO notifications (user_id, type, title, message, payload)
                     VALUES ?`,
                    [notificationValues],
                    () => {},
                );
            }
        });
        
        res.status(201).json({ 
            message: 'Your message has been sent successfully. We will get back to you soon!',
            contactId: result.insertId 
        });
    });
});

// Get all contacts (Admin only)
router.get('/', authenticateToken, isAdmin, (req, res) => {
    const { status } = req.query;
    
    let query = 'SELECT * FROM contacts';
    const params = [];
    
    if (status) {
        query += ' WHERE status = ?';
        params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    db.query(query, params, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(results);
    });
});

// Get contact by ID (Admin only)
router.get('/:id', authenticateToken, isAdmin, (req, res) => {
    db.query('SELECT * FROM contacts WHERE id = ?', [req.params.id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        
        // Mark as read
        db.query('UPDATE contacts SET status = ? WHERE id = ? AND status = ?', 
            ['read', req.params.id, 'new'], 
            () => {}
        );
        
        res.json(results[0]);
    });
});

// Update contact status (Admin only)
router.put('/:id/status', authenticateToken, isAdmin, (req, res) => {
    const { status } = req.body;
    
    if (!['new', 'read', 'responded'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    
    db.query('UPDATE contacts SET status = ? WHERE id = ?', [status, req.params.id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error updating status' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        
        res.json({ message: 'Status updated successfully' });
    });
});

// Delete contact (Admin only)
router.delete('/:id', authenticateToken, isAdmin, (req, res) => {
    db.query('DELETE FROM contacts WHERE id = ?', [req.params.id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Error deleting contact' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }
        
        res.json({ message: 'Contact deleted successfully' });
    });
});

module.exports = router;
