const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { db } = require('../config/db');
const { createInvoicePdfBuffer } = require('../utils/invoicePdf');
const { getAdminSettings } = require('../utils/adminSettings');
const { insertAdminNotifications, getAdminRecipients } = require('../utils/adminNotifications');
const { sendEmail } = require('../utils/emailService');

const ALLOWED_ORDER_STATUSES = new Set([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]);

const ALLOWED_PAYMENT_STATUSES = new Set([
  'pending',
  'paid',
  'failed',
]);

const SHIPMENT_STATUS_FOR_ORDER_STATUS = {
  pending: 'pending',
  confirmed: 'packed',
  processing: 'packed',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'returned',
};

const safeNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const buildInClause = (ids) => ids.map(() => '?').join(', ');

const normalizePaymentMethod = (rawMethod) => {
  const nextMethod = String(rawMethod || 'cod').trim().toLowerCase();

  if (nextMethod === 'creditcard' || nextMethod === 'credit_card') {
    return 'card';
  }

  if (nextMethod === 'easypaisa' || nextMethod === 'jazzcash') {
    return nextMethod;
  }

  if (nextMethod === 'card' || nextMethod === 'online') {
    return nextMethod;
  }

  return 'cod';
};

const getAllowedPaymentMethods = async (connection) => {
  const fallback = new Set(['cod', 'card', 'online', 'easypaisa', 'jazzcash']);

  try {
    const [rows] = await connection.query(
      `SELECT code
       FROM payment_methods
       WHERE is_active = TRUE`,
    );

    if (!rows.length) {
      return fallback;
    }

    return new Set(
      rows
        .map((row) => String(row.code || '').trim().toLowerCase())
        .filter(Boolean),
    );
  } catch (error) {
    return fallback;
  }
};

const parseNullableDate = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const createTrackingNumber = (orderId) => `TRK-${String(orderId).padStart(10, '0')}`;

const insertNotification = async (
  connection,
  userId,
  type,
  title,
  message,
  payload = null,
) => {
  await connection.query(
    `INSERT INTO notifications (user_id, type, title, message, payload)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, type, title, message, payload ? JSON.stringify(payload) : null],
  );
};

const insertNotificationForAdmins = async (
  connection,
  type,
  title,
  message,
  payload = null,
  excludeUserId = null,
) =>
  insertAdminNotifications(connection, {
    type,
    title,
    message,
    payload,
    excludeUserId,
  });

const formatOrderNumber = (orderId) => `ORD-${String(orderId).padStart(6, '0')}`;

const sendAdminAlertEmails = async ({
  order,
  orderId,
  totalAmount,
  lowStockEvents,
  adminSettings,
  excludeUserId,
}) => {
  const shouldSendOrderEmail =
    adminSettings.emailNotifications && adminSettings.orderNotifications;
  const shouldSendLowStockEmail =
    adminSettings.emailNotifications &&
    adminSettings.lowStockAlerts &&
    lowStockEvents.length > 0;

  if (!shouldSendOrderEmail && !shouldSendLowStockEmail) {
    return;
  }

  const recipients = await getAdminRecipients(db.promise(), excludeUserId);
  const emailList = recipients.map((row) => row.email).filter(Boolean);

  if (!emailList.length) {
    return;
  }

  const to = emailList.join(",");

  if (shouldSendOrderEmail) {
    const orderNumber = formatOrderNumber(orderId);
    const subject = `New order received: ${orderNumber}`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h2 style="margin: 0 0 8px; color: #0f172a;">New Order Received</h2>
        <p style="margin: 0 0 10px;">Order ${orderNumber} has been placed.</p>
        <p style="margin: 0 0 6px;">Customer: ${order?.customer_name || "Guest"}</p>
        <p style="margin: 0 0 6px;">Email: ${order?.customer_email || "-"}</p>
        <p style="margin: 0;">Total: ${Number(totalAmount || 0).toFixed(2)}</p>
      </div>
    `;

    await sendEmail({ to, subject, html });
  }

  if (shouldSendLowStockEmail) {
    const subject = "Low stock alert";
    const itemsHtml = lowStockEvents
      .map(
        (event) =>
          `<li>${event.product_name} - ${event.stock_quantity} left</li>`,
      )
      .join("");

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937;">
        <h2 style="margin: 0 0 8px; color: #0f172a;">Low Stock Alert</h2>
        <p style="margin: 0 0 10px;">The following products are running low:</p>
        <ul style="margin: 0; padding-left: 18px;">${itemsHtml}</ul>
      </div>
    `;

    await sendEmail({ to, subject, html });
  }
};

const insertOrderStatusHistory = async (
  connection,
  { orderId, fromStatus = null, toStatus, changedByUserId = null, note = null },
) => {
  await connection.query(
    `INSERT INTO order_status_history
     (order_id, from_status, to_status, changed_by_user_id, note)
     VALUES (?, ?, ?, ?, ?)`,
    [orderId, fromStatus, toStatus, changedByUserId, note],
  );
};

const insertPaymentTransaction = async (
  connection,
  {
    orderId,
    userId,
    transactionType = 'payment',
    provider = 'cod',
    amount,
    status = 'pending',
    gatewayReference = null,
    payload = null,
  },
) => {
  await connection.query(
    `INSERT INTO payment_transactions
     (order_id, user_id, transaction_type, provider, amount, status, gateway_reference, payload, processed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      orderId,
      userId,
      transactionType,
      provider,
      safeNumber(amount, 0),
      status,
      gatewayReference,
      payload ? JSON.stringify(payload) : null,
    ],
  );
};

const insertInventoryMovement = async (
  connection,
  {
    productId,
    orderId = null,
    movementType,
    quantityChange,
    previousStock,
    newStock,
    note = null,
    createdByUserId = null,
  },
) => {
  await connection.query(
    `INSERT INTO inventory_movements
     (product_id, order_id, movement_type, quantity_change, previous_stock, new_stock, note, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      orderId,
      movementType,
      quantityChange,
      previousStock,
      newStock,
      note,
      createdByUserId,
    ],
  );
};

const upsertShipmentForOrder = async (
  connection,
  {
    orderId,
    orderStatus,
    courierName = null,
    trackingNumber = null,
    estimatedDelivery = null,
    shipmentStatus = null,
  },
) => {
  const [existingRows] = await connection.query(
    'SELECT id FROM shipments WHERE order_id = ? LIMIT 1',
    [orderId],
  );

  const nextShipmentStatus =
    shipmentStatus || SHIPMENT_STATUS_FOR_ORDER_STATUS[orderStatus] || 'pending';
  const nextTrackingNumber = trackingNumber || createTrackingNumber(orderId);
  const shippedAt =
    orderStatus === 'shipped' || nextShipmentStatus === 'shipped' ? new Date() : null;
  const deliveredAt =
    orderStatus === 'delivered' || nextShipmentStatus === 'delivered' ? new Date() : null;

  if (existingRows.length > 0) {
    await connection.query(
      `UPDATE shipments
       SET courier_name = COALESCE(?, courier_name),
           tracking_number = COALESCE(?, tracking_number),
           shipment_status = ?,
           shipped_at = COALESCE(?, shipped_at),
           estimated_delivery = COALESCE(?, estimated_delivery),
           delivered_at = COALESCE(?, delivered_at),
           metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.updated_from_order_status', ?)
       WHERE order_id = ?`,
      [
        courierName,
        nextTrackingNumber,
        nextShipmentStatus,
        shippedAt,
        estimatedDelivery,
        deliveredAt,
        orderStatus,
        orderId,
      ],
    );

    return;
  }

  await connection.query(
    `INSERT INTO shipments
     (order_id, courier_name, tracking_number, shipment_status, shipped_at, estimated_delivery, delivered_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, JSON_OBJECT('created_from_order_status', ?))`,
    [
      orderId,
      courierName,
      nextTrackingNumber,
      nextShipmentStatus,
      shippedAt,
      estimatedDelivery,
      deliveredAt,
      orderStatus,
    ],
  );
};

const hydrateOrders = async (connection, orders) => {
  if (!orders.length) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);
  const inClause = buildInClause(orderIds);

  const [items] = await connection.query(
    `SELECT oi.*, p.name AS product_name, p.image_url
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id IN (${inClause})
     ORDER BY oi.id ASC`,
    orderIds,
  );

  const [statusHistory] = await connection.query(
    `SELECT *
     FROM order_status_history
     WHERE order_id IN (${inClause})
     ORDER BY created_at ASC`,
    orderIds,
  );

  const [shipments] = await connection.query(
    `SELECT *
     FROM shipments
     WHERE order_id IN (${inClause})`,
    orderIds,
  );

  const [paymentTransactions] = await connection.query(
    `SELECT *
     FROM payment_transactions
     WHERE order_id IN (${inClause})
     ORDER BY created_at DESC`,
    orderIds,
  );

  const itemsByOrderId = new Map();
  const statusByOrderId = new Map();
  const shipmentByOrderId = new Map();
  const paymentByOrderId = new Map();

  for (const item of items) {
    const current = itemsByOrderId.get(item.order_id) || [];
    current.push({
      ...item,
      name: item.product_name || item.name,
      image: item.image_url,
      image_url: item.image_url,
    });
    itemsByOrderId.set(item.order_id, current);
  }

  for (const status of statusHistory) {
    const current = statusByOrderId.get(status.order_id) || [];
    current.push(status);
    statusByOrderId.set(status.order_id, current);
  }

  for (const shipment of shipments) {
    shipmentByOrderId.set(shipment.order_id, shipment);
  }

  for (const payment of paymentTransactions) {
    const current = paymentByOrderId.get(payment.order_id) || [];
    current.push(payment);
    paymentByOrderId.set(payment.order_id, current);
  }

  return orders.map((order) => {
    const orderItems = itemsByOrderId.get(order.id) || [];
    return {
      ...order,
      order_date: order.order_date || order.created_at,
      item_count: order.item_count || orderItems.length,
      items: orderItems,
      status_history: statusByOrderId.get(order.id) || [],
      shipment: shipmentByOrderId.get(order.id) || null,
      payment_transactions: paymentByOrderId.get(order.id) || [],
    };
  });
};

const getOrderWithAuthorization = async (connection, orderId, user) => {
  const [orderRows] = await connection.query(
    'SELECT * FROM orders WHERE id = ? LIMIT 1',
    [orderId],
  );

  if (orderRows.length === 0) {
    return { error: { code: 404, message: 'Order not found' } };
  }

  const order = orderRows[0];
  if (order.user_id !== user.id && user.role !== 'admin') {
    return { error: { code: 403, message: 'Access denied' } };
  }

  return { order };
};

// Create order from cart
router.post('/create', authenticateToken, async (req, res) => {
  const shippingAddress = String(req.body?.shipping_address || '').trim();
  const phone = String(req.body?.phone || '').trim();

  if (!shippingAddress || !phone) {
    return res
      .status(400)
      .json({ error: 'Shipping address and phone are required' });
  }

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [cartItems] = await connection.query(
      `SELECT c.product_id, c.quantity, p.name, p.image_url, p.price, p.stock_quantity, p.discount_percentage,
              (p.price - (p.price * p.discount_percentage / 100)) AS final_price
       FROM cart c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?
       FOR UPDATE`,
      [req.user.id],
    );

    if (cartItems.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'Cart is empty' });
    }

    for (const item of cartItems) {
      if (safeNumber(item.stock_quantity, 0) < safeNumber(item.quantity, 0)) {
        await connection.rollback();
        return res.status(400).json({
          error: `Insufficient stock for ${item.name}`,
        });
      }
    }

    const calculatedSubtotal = cartItems.reduce(
      (sum, item) => sum + safeNumber(item.final_price) * safeNumber(item.quantity),
      0,
    );

    // SECURITY: Never trust client-supplied financial values.
    // Always compute totals server-side from verified DB prices.
    const subtotal = calculatedSubtotal;
    const discountAmount = safeNumber(req.body?.discount_amount, 0);
    const tax = safeNumber(req.body?.tax, 0);
    const shippingCost = safeNumber(req.body?.shipping_cost, 0);
    const totalAmount = Math.max(0, subtotal - discountAmount + tax + shippingCost);

    const paymentMethod = normalizePaymentMethod(req.body?.payment_method);
    const allowedPaymentMethods = await getAllowedPaymentMethods(connection);

    if (!allowedPaymentMethods.has(paymentMethod)) {
      await connection.rollback();
      return res.status(400).json({
        error: 'Selected payment method is currently unavailable',
      });
    }

    const paymentStatusFallback = paymentMethod === 'cod' ? 'pending' : 'paid';
    const requestedPaymentStatus = String(
      req.body?.payment_status || paymentStatusFallback,
    ).trim().toLowerCase();
    const paymentStatus = ALLOWED_PAYMENT_STATUSES.has(requestedPaymentStatus)
      ? requestedPaymentStatus
      : paymentStatusFallback;

    const customerName = req.body?.customer_name
      ? String(req.body.customer_name).trim()
      : null;
    const customerEmail = req.body?.customer_email
      ? String(req.body.customer_email).trim().toLowerCase()
      : null;
    const city = req.body?.city ? String(req.body.city).trim() : null;
    const postalCode = req.body?.postal_code
      ? String(req.body.postal_code).trim()
      : null;
    const couponCode = req.body?.coupon_code
      ? String(req.body.coupon_code).trim().toUpperCase()
      : null;
    const notes = req.body?.notes ? String(req.body.notes).trim() : null;
    const addressId = Number.isInteger(Number(req.body?.address_id))
      ? Number(req.body.address_id)
      : null;
    const estimatedDelivery =
      parseNullableDate(req.body?.estimated_delivery) ||
      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    const paymentDetailsPayload = req.body?.payment_details || null;
    const adminSettings = await getAdminSettings(connection);
    const lowStockEvents = [];
    const lowStockThreshold = Number(adminSettings.lowStockThreshold) || 10;

    const [orderInsertResult] = await connection.query(
      `INSERT INTO orders
       (user_id, address_id, customer_name, customer_email, total_amount, subtotal, discount_amount, tax, shipping_cost,
        coupon_code, status, payment_method, payment_status, payment_details, shipping_address, city, postal_code, phone,
        estimated_delivery, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        addressId,
        customerName,
        customerEmail,
        totalAmount,
        subtotal,
        discountAmount,
        tax,
        shippingCost,
        couponCode,
        paymentMethod,
        paymentStatus,
        paymentDetailsPayload ? JSON.stringify(paymentDetailsPayload) : null,
        shippingAddress,
        city,
        postalCode,
        phone,
        estimatedDelivery,
        notes,
      ],
    );

    const orderId = orderInsertResult.insertId;

    const orderItemsValues = cartItems.map((item) => {
      const unitPrice = safeNumber(item.final_price, safeNumber(item.price, 0));
      const quantity = safeNumber(item.quantity, 0);
      return [orderId, item.product_id, quantity, unitPrice, unitPrice * quantity];
    });

    await connection.query(
      `INSERT INTO order_items
       (order_id, product_id, quantity, price, subtotal)
       VALUES ?`,
      [orderItemsValues],
    );

    for (const item of cartItems) {
      const previousStock = safeNumber(item.stock_quantity, 0);
      const quantity = safeNumber(item.quantity, 0);
      const newStock = previousStock - quantity;

      if (
        adminSettings.lowStockAlerts &&
        previousStock >= lowStockThreshold &&
        newStock < lowStockThreshold
      ) {
        lowStockEvents.push({
          product_id: item.product_id,
          product_name: item.name,
          stock_quantity: newStock,
          threshold: lowStockThreshold,
        });
      }

      await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [
        newStock,
        item.product_id,
      ]);

      await insertInventoryMovement(connection, {
        productId: item.product_id,
        orderId,
        movementType: 'sale',
        quantityChange: -Math.abs(quantity),
        previousStock,
        newStock,
        note: `Stock reduced due to order #${orderId}`,
        createdByUserId: req.user.id,
      });
    }

    await insertOrderStatusHistory(connection, {
      orderId,
      fromStatus: null,
      toStatus: 'pending',
      changedByUserId: req.user.id,
      note: 'Order created',
    });

    await insertPaymentTransaction(connection, {
      orderId,
      userId: req.user.id,
      transactionType: 'payment',
      provider: paymentMethod,
      amount: totalAmount,
      status: paymentStatus,
      payload: paymentDetailsPayload,
    });

    await connection.query('DELETE FROM cart WHERE user_id = ?', [req.user.id]);

    await insertNotification(
      connection,
      req.user.id,
      'order_created',
      'Order Created',
      `Your order #${orderId} has been placed successfully.`,
      { order_id: orderId },
    );

    if (adminSettings.orderNotifications) {
      await insertNotificationForAdmins(
        connection,
        'admin_order_created',
        'New Order Received',
        `A new order #${orderId} has been placed and requires processing.`,
        {
          order_id: orderId,
          user_id: req.user.id,
          total_amount: safeNumber(totalAmount, 0),
          payment_status: paymentStatus,
        },
        req.user.id,
      );
    }

    if (adminSettings.lowStockAlerts && lowStockEvents.length > 0) {
      for (const event of lowStockEvents) {
        await insertNotificationForAdmins(
          connection,
          'admin_low_stock',
          'Low Stock Alert',
          `${event.product_name} is low on stock (${event.stock_quantity} left).`,
          {
            product_id: event.product_id,
            stock_quantity: event.stock_quantity,
            threshold: event.threshold,
          },
          req.user.id,
        );
      }
    }

    await connection.commit();

    const [orderRows] = await connection.query(
      `SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o
       WHERE o.id = ?`,
      [orderId],
    );

    const [order] = await hydrateOrders(connection, orderRows);

    if (
      adminSettings.emailNotifications &&
      (adminSettings.orderNotifications ||
        (adminSettings.lowStockAlerts && lowStockEvents.length > 0))
    ) {
      const alertContext = {
        order,
        orderId,
        totalAmount,
        lowStockEvents,
        adminSettings,
        excludeUserId: req.user.id,
      };

      setImmediate(() => {
        sendAdminAlertEmails(alertContext).catch(() => undefined);
      });
    }

    res.status(201).json({
      message: 'Order created successfully',
      orderId,
      total: totalAmount.toFixed(2),
      order,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Error creating order' });
  } finally {
    connection.release();
  }
});

// Get all orders for current user
router.get('/my-orders', authenticateToken, async (req, res) => {
  try {
    const [orders] = await db.promise().query(
      `SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`,
      [req.user.id],
    );

    const hydratedOrders = await hydrateOrders(db.promise(), orders);
    res.json(hydratedOrders);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all orders (Admin only)
router.get('/admin/all', authenticateToken, isAdmin, async (req, res) => {
  const status = req.query.status ? String(req.query.status).trim() : null;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  try {
    let query = `
      SELECT o.*, u.name AS customer_name, u.email AS customer_email,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
      FROM orders o
      JOIN users u ON o.user_id = u.id
    `;
    const params = [];

    if (status) {
      query += ' WHERE o.status = ?';
      params.push(status);
    }

    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [orders] = await db.promise().query(query, params);
    const hydratedOrders = await hydrateOrders(db.promise(), orders);
    res.json(hydratedOrders);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Download invoice PDF (generated on backend from DB order data)
router.get('/:id/invoice', authenticateToken, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const check = await getOrderWithAuthorization(db.promise(), orderId, req.user);
    if (check.error) {
      return res.status(check.error.code).json({ error: check.error.message });
    }

    const [orders] = await db.promise().query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.id = ?`,
      [orderId],
    );

    if (!orders.length) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const [order] = await hydrateOrders(db.promise(), orders);
    const pdfBuffer = await createInvoicePdfBuffer(order, { currency: 'PKR' });
    const orderNumber = `ORD-${String(order.id).padStart(6, '0')}`;
    const fileName = `invoice-${orderNumber}.pdf`;

    // Return a real file attachment response so frontend can treat status 200 as success.
    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.end(pdfBuffer);
  } catch (error) {
    console.error('Invoice PDF generation error:', error);

    if (res.headersSent) {
      return;
    }

    return res.status(500).json({ error: 'Could not generate invoice PDF' });
  }
});

// Get order details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const check = await getOrderWithAuthorization(db.promise(), orderId, req.user);
    if (check.error) {
      return res.status(check.error.code).json({ error: check.error.message });
    }

    const [orders] = await db.promise().query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.id = ?`,
      [orderId],
    );

    const [order] = await hydrateOrders(db.promise(), orders);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get status timeline for an order
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const check = await getOrderWithAuthorization(db.promise(), orderId, req.user);
    if (check.error) {
      return res.status(check.error.code).json({ error: check.error.message });
    }

    const [history] = await db.promise().query(
      `SELECT osh.*, u.name AS changed_by_name
       FROM order_status_history osh
       LEFT JOIN users u ON u.id = osh.changed_by_user_id
       WHERE osh.order_id = ?
       ORDER BY osh.created_at ASC`,
      [orderId],
    );

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Get shipment details for an order
router.get('/:id/shipment', authenticateToken, async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const check = await getOrderWithAuthorization(db.promise(), orderId, req.user);
    if (check.error) {
      return res.status(check.error.code).json({ error: check.error.message });
    }

    const [rows] = await db.promise().query(
      'SELECT * FROM shipments WHERE order_id = ? LIMIT 1',
      [orderId],
    );

    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Cancel order
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
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

    if (!['pending', 'confirmed', 'processing'].includes(order.status)) {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: 'Only pending/confirmed/processing orders can be cancelled' });
    }

    const [items] = await connection.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [orderId],
    );

    for (const item of items) {
      const [productRows] = await connection.query(
        'SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE',
        [item.product_id],
      );

      if (productRows.length === 0) {
        continue;
      }

      const previousStock = safeNumber(productRows[0].stock_quantity, 0);
      const restoredStock = previousStock + safeNumber(item.quantity, 0);

      await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [
        restoredStock,
        item.product_id,
      ]);

      await insertInventoryMovement(connection, {
        productId: item.product_id,
        orderId,
        movementType: 'cancel_restore',
        quantityChange: Math.abs(safeNumber(item.quantity, 0)),
        previousStock,
        newStock: restoredStock,
        note: `Stock restored after cancellation of order #${orderId}`,
        createdByUserId: req.user.id,
      });
    }

    await connection.query('UPDATE orders SET status = ? WHERE id = ?', [
      'cancelled',
      orderId,
    ]);

    await insertOrderStatusHistory(connection, {
      orderId,
      fromStatus: order.status,
      toStatus: 'cancelled',
      changedByUserId: req.user.id,
      note: 'Cancelled by customer',
    });

    await insertNotification(
      connection,
      req.user.id,
      'order_cancelled',
      'Order Cancelled',
      `Your order #${orderId} has been cancelled.`,
      { order_id: orderId },
    );

    await connection.commit();
    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: 'Error cancelling order' });
  } finally {
    connection.release();
  }
});

// Update shipment details (Admin only)
router.put('/:id/shipment', authenticateToken, isAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const {
    courier_name,
    tracking_number,
    shipment_status,
    estimated_delivery,
    metadata,
  } = req.body || {};

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      'SELECT id, status, user_id FROM orders WHERE id = ? FOR UPDATE',
      [orderId],
    );

    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    await upsertShipmentForOrder(connection, {
      orderId,
      orderStatus: orderRows[0].status,
      courierName: courier_name || null,
      trackingNumber: tracking_number || null,
      estimatedDelivery: parseNullableDate(estimated_delivery),
      shipmentStatus: shipment_status || null,
    });

    if (metadata) {
      await connection.query(
        'UPDATE shipments SET metadata = ? WHERE order_id = ?',
        [JSON.stringify(metadata), orderId],
      );
    }

    await insertNotification(
      connection,
      orderRows[0].user_id,
      'shipment_updated',
      'Shipment Updated',
      `Shipment details for order #${orderId} have been updated.`,
      { order_id: orderId },
    );

    await connection.commit();

    const [rows] = await db
      .promise()
      .query('SELECT * FROM shipments WHERE order_id = ? LIMIT 1', [orderId]);

    res.json({
      message: 'Shipment updated successfully',
      shipment: rows[0] || null,
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: 'Error updating shipment' });
  } finally {
    connection.release();
  }
});

// Update order status (Admin only)
router.put('/:id/status', authenticateToken, isAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const nextStatusRaw = String(req.body?.status || '').trim().toLowerCase();
  const requestedPaymentStatus = req.body?.payment_status
    ? String(req.body.payment_status).trim().toLowerCase()
    : null;

  if (!ALLOWED_ORDER_STATUSES.has(nextStatusRaw)) {
    return res.status(400).json({ error: 'Invalid order status' });
  }

  if (
    requestedPaymentStatus &&
    !ALLOWED_PAYMENT_STATUSES.has(requestedPaymentStatus)
  ) {
    return res.status(400).json({ error: 'Invalid payment status' });
  }

  const note = req.body?.note ? String(req.body.note).trim() : null;
  const courierName = req.body?.courier_name
    ? String(req.body.courier_name).trim()
    : null;
  const trackingNumber = req.body?.tracking_number
    ? String(req.body.tracking_number).trim()
    : null;
  const estimatedDelivery = parseNullableDate(req.body?.estimated_delivery);

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [orderId],
    );

    if (orderRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRows[0];
    const currentPaymentStatus = String(order.payment_status || 'pending').toLowerCase();
    const nextPaymentStatus = requestedPaymentStatus || currentPaymentStatus;

    await connection.query(
      `UPDATE orders
       SET status = ?, payment_status = ?, estimated_delivery = COALESCE(?, estimated_delivery)
       WHERE id = ?`,
      [nextStatusRaw, nextPaymentStatus, estimatedDelivery, orderId],
    );

    if (order.status !== nextStatusRaw) {
      await insertOrderStatusHistory(connection, {
        orderId,
        fromStatus: order.status,
        toStatus: nextStatusRaw,
        changedByUserId: req.user.id,
        note,
      });
    }

    if (nextStatusRaw === 'cancelled' && order.status !== 'cancelled') {
      const [items] = await connection.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [orderId],
      );

      for (const item of items) {
        const [productRows] = await connection.query(
          'SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE',
          [item.product_id],
        );

        if (!productRows.length) {
          continue;
        }

        const previousStock = safeNumber(productRows[0].stock_quantity, 0);
        const restoredStock = previousStock + safeNumber(item.quantity, 0);

        await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [
          restoredStock,
          item.product_id,
        ]);

        await insertInventoryMovement(connection, {
          productId: item.product_id,
          orderId,
          movementType: 'cancel_restore',
          quantityChange: Math.abs(safeNumber(item.quantity, 0)),
          previousStock,
          newStock: restoredStock,
          note: `Stock restored after admin cancelled order #${orderId}`,
          createdByUserId: req.user.id,
        });
      }
    }

    if (nextStatusRaw === 'shipped' || nextStatusRaw === 'delivered') {
      await upsertShipmentForOrder(connection, {
        orderId,
        orderStatus: nextStatusRaw,
        courierName,
        trackingNumber,
        estimatedDelivery,
      });
    }

    if (nextPaymentStatus !== currentPaymentStatus) {
      await insertPaymentTransaction(connection, {
        orderId,
        userId: order.user_id,
        transactionType: 'payment',
        provider: normalizePaymentMethod(order.payment_method),
        amount: order.total_amount,
        status: nextPaymentStatus,
        payload: {
          changed_from: currentPaymentStatus,
          changed_to: nextPaymentStatus,
          changed_by: req.user.id,
        },
      });
    }

    await insertNotification(
      connection,
      order.user_id,
      'order_status_changed',
      'Order Status Updated',
      `Your order #${orderId} status is now ${nextStatusRaw}.`,
      {
        order_id: orderId,
        status: nextStatusRaw,
        payment_status: nextPaymentStatus,
      },
    );

    await connection.commit();
    res.json({ message: 'Order status updated successfully' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: 'Error updating order status' });
  } finally {
    connection.release();
  }
});

// Delete order (Admin only)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  const connection = await db.promise().getConnection();

  try {
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [orderId],
    );

    if (!orderRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderRows[0];
    const shouldRestoreStock = order.status !== 'cancelled';

    if (shouldRestoreStock) {
      const [items] = await connection.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [orderId],
      );

      for (const item of items) {
        const [productRows] = await connection.query(
          'SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE',
          [item.product_id],
        );

        if (!productRows.length) {
          continue;
        }

        const previousStock = safeNumber(productRows[0].stock_quantity, 0);
        const restoredStock = previousStock + safeNumber(item.quantity, 0);

        await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [
          restoredStock,
          item.product_id,
        ]);

        await insertInventoryMovement(connection, {
          productId: item.product_id,
          orderId,
          movementType: 'cancel_restore',
          quantityChange: Math.abs(safeNumber(item.quantity, 0)),
          previousStock,
          newStock: restoredStock,
          note: `Stock restored after admin deleted order #${orderId}`,
          createdByUserId: req.user.id,
        });
      }
    }

    await insertNotification(
      connection,
      order.user_id,
      'order_deleted',
      'Order Removed',
      `Order #${orderId} has been removed by admin.`,
      { order_id: orderId },
    );

    await connection.query('DELETE FROM orders WHERE id = ?', [orderId]);

    await connection.commit();
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: 'Error deleting order' });
  } finally {
    connection.release();
  }
});

module.exports = router;
