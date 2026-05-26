const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { restrictBody } = require('../middleware/security');

const ALLOWED_RETURN_STATUSES = new Set([
  'requested',
  'approved',
  'rejected',
  'received',
  'refunded',
]);

const safeNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

// Create return request (customer)
router.post('/request', authenticateToken, restrictBody('order_id', 'reason', 'details', 'requested_amount'), async (req, res) => {
  const orderId = Number(req.body?.order_id);
  const reason = String(req.body?.reason || '').trim();
  const details = req.body?.details ? String(req.body.details).trim() : null;
  const requestedAmount = safeNumber(req.body?.requested_amount, 0);

  if (!Number.isInteger(orderId)) {
    return res.status(400).json({ error: 'Valid order_id is required' });
  }

  if (!reason) {
    return res.status(400).json({ error: 'Return reason is required' });
  }

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      'SELECT id, user_id, status, total_amount FROM orders WHERE id = ? FOR UPDATE',
      [orderId],
    );

    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRows[0];
    if (order.user_id !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!['delivered', 'shipped'].includes(order.status)) {
      await connection.rollback();
      return res.status(400).json({ error: 'Returns are only allowed for shipped/delivered orders' });
    }

    const [existingRows] = await connection.query(
      `SELECT id FROM returns_requests
       WHERE order_id = ? AND user_id = ? AND status IN ('requested', 'approved', 'received')
       LIMIT 1`,
      [orderId, req.user.id],
    );

    if (existingRows.length > 0) {
      await connection.rollback();
      return res.status(409).json({ error: 'A return request for this order is already in progress' });
    }

    const [insertResult] = await connection.query(
      `INSERT INTO returns_requests
       (order_id, user_id, reason, details, requested_amount, status)
       VALUES (?, ?, ?, ?, ?, 'requested')`,
      [orderId, req.user.id, reason, details, requestedAmount > 0 ? requestedAmount : order.total_amount],
    );

    const returnRequestId = insertResult.insertId;

    await connection.query(
      `INSERT INTO notifications (user_id, type, title, message, payload)
       VALUES (?, 'return_created', 'Return Request Created', ?, ?)`,
      [
        req.user.id,
        `Your return request #${returnRequestId} for order #${orderId} has been submitted.`,
        JSON.stringify({ return_request_id: returnRequestId, order_id: orderId }),
      ],
    );

    const [adminRows] = await connection.query(
      `SELECT id FROM users WHERE role = 'admin'`,
    );

    if (adminRows.length > 0) {
      const notificationValues = adminRows.map((admin) => [
        admin.id,
        'return_review_required',
        'New Return Request',
        `Return request #${returnRequestId} needs review.`,
        JSON.stringify({ return_request_id: returnRequestId, order_id: orderId, user_id: req.user.id }),
      ]);

      await connection.query(
        `INSERT INTO notifications (user_id, type, title, message, payload)
         VALUES ?`,
        [notificationValues],
      );
    }

    await connection.commit();

    const [rows] = await db
      .promise()
      .query('SELECT * FROM returns_requests WHERE id = ?', [returnRequestId]);

    return res.status(201).json({
      message: 'Return request created successfully',
      returnRequest: rows[0],
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ error: 'Error creating return request' });
  } finally {
    connection.release();
  }
});

// Get current user's return requests
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT rr.*, o.total_amount, o.status AS order_status
       FROM returns_requests rr
       JOIN orders o ON o.id = rr.order_id
       WHERE rr.user_id = ?
       ORDER BY rr.created_at DESC`,
      [req.user.id],
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin list (mirrors /admin/returns for direct route usage)
router.get('/admin/all', authenticateToken, isAdmin, async (req, res) => {
  const status = req.query.status ? String(req.query.status).trim() : null;
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

  if (status && !ALLOWED_RETURN_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid return status filter' });
  }

  try {
    let query = `
      SELECT rr.*, u.name AS user_name, u.email AS user_email,
             o.total_amount, o.status AS order_status
      FROM returns_requests rr
      JOIN users u ON u.id = rr.user_id
      JOIN orders o ON o.id = rr.order_id
    `;
    const params = [];

    if (status) {
      query += ' WHERE rr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY rr.created_at DESC LIMIT ?';
    params.push(limit);

    const [rows] = await db.promise().query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get return request detail by id
router.get('/:id', authenticateToken, async (req, res) => {
  const returnId = Number(req.params.id);
  if (!Number.isInteger(returnId)) {
    return res.status(400).json({ error: 'Invalid return request id' });
  }

  try {
    const [rows] = await db.promise().query(
      `SELECT rr.*, o.total_amount, o.status AS order_status, o.user_id AS order_user_id
       FROM returns_requests rr
       JOIN orders o ON o.id = rr.order_id
       WHERE rr.id = ?
       LIMIT 1`,
      [returnId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Return request not found' });
    }

    const record = rows[0];
    if (req.user.role !== 'admin' && record.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [refunds] = await db.promise().query(
      'SELECT * FROM refund_transactions WHERE return_request_id = ? ORDER BY created_at DESC',
      [returnId],
    );

    res.json({
      ...record,
      refunds,
    });
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
