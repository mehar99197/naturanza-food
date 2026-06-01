const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { restrictBody } = require('../middleware/security');
const { db } = require('../config/db');
const { createInvoicePdfBuffer } = require('../utils/invoicePdf');
const { getAdminSettings } = require('../utils/adminSettings');
const { insertAdminNotifications, getAdminRecipients } = require('../utils/adminNotifications');
const { sendEmail } = require('../utils/emailService');
const { reserveStockOnConnection } = require('../utils/stockReservations');

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
  'partial',
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

const sendCustomerOrderConfirmation = async ({
  order,
  orderId,
  customerEmail,
  customerName,
  totalAmount,
  items,
}) => {
  if (!customerEmail) return;

  const orderNumber = formatOrderNumber(orderId);
  const orderDateRaw = order?.order_date || order?.created_at;
  const orderDate = orderDateRaw
    ? new Date(orderDateRaw).toLocaleString("en-PK")
    : "-";
  const paymentMethod = normalizePaymentMethod(order?.payment_method);
  const paymentMethodLabel =
    paymentMethod === "easypaisa"
      ? "EasyPaisa"
      : paymentMethod === "jazzcash"
        ? "JazzCash"
        : paymentMethod === "card"
          ? "Card"
          : paymentMethod === "online"
            ? "Online"
            : "Cash on Delivery";
  const paymentStatusRaw = String(order?.payment_status || "pending").trim().toLowerCase();
  const paymentStatusLabel =
    paymentStatusRaw.charAt(0).toUpperCase() + paymentStatusRaw.slice(1);
  const orderSubtotal = safeNumber(order?.subtotal, 0);
  const orderDiscount = safeNumber(order?.discount_amount, 0);
  const orderTax = safeNumber(order?.tax, 0);
  const orderShipping = safeNumber(order?.shipping_cost, 0);
  const orderTotal = safeNumber(order?.total_amount, safeNumber(totalAmount, 0));
  const codRemaining = Math.max(0, orderSubtotal - orderDiscount + orderTax);
  const orderCoupon = order?.coupon_code ? String(order.coupon_code) : null;
  const orderNotes = order?.notes ? String(order.notes) : null;
  const shippingAddress = order?.shipping_address
    ? String(order.shipping_address)
    : "-";
  const shippingCity = order?.city ? String(order.city) : "-";
  const phoneNumber = order?.phone ? String(order.phone) : "-";
  const couponRow = orderCoupon
    ? `<tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;">Coupon Code</td>
          <td style="padding:8px 0;color:#0f172a;font-size:13px;text-align:right;">${orderCoupon}</td>
        </tr>`
    : "";
  const notesRow = orderNotes
    ? `<tr>
          <td style="padding:8px 0;color:#64748b;font-size:13px;">Order Notes</td>
          <td style="padding:8px 0;color:#0f172a;font-size:13px;text-align:right;">${orderNotes}</td>
        </tr>`
    : "";
  const codRows =
    paymentMethod === "cod"
      ? `<tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;">Advance Paid (Delivery Fee)</td>
            <td style="padding:8px 0;color:#0f172a;font-size:13px;text-align:right;">PKR ${orderShipping.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;">Remaining COD Balance</td>
            <td style="padding:8px 0;color:#0f172a;font-size:13px;text-align:right;">PKR ${codRemaining.toFixed(2)}</td>
          </tr>`
      : "";
  const itemsHtml = (items || [])
    .map(
      (item, i) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;">${i + 1}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${item.name || item.product_name}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;">${safeNumber(item.quantity, 0)}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">PKR ${safeNumber(item.final_price || item.price, 0).toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">PKR ${(safeNumber(item.final_price || item.price, 0) * safeNumber(item.quantity, 0)).toFixed(2)}</td>
        </tr>`,
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f0fdf4;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0fdf4;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a 0%,#059669 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;">Order Confirmed! 🎉</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">${orderNumber}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">Hi <strong>${customerName || "Valued Customer"}</strong>,</p>
              <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">Thank you for your order! We're getting it ready for you.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:24px;">
                <tbody>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">Order Date</td>
                    <td style="padding:8px 0;color:#0f172a;font-size:13px;text-align:right;">${orderDate}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">Payment Method</td>
                    <td style="padding:8px 0;color:#0f172a;font-size:13px;text-align:right;">${paymentMethodLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">Payment Status</td>
                    <td style="padding:8px 0;color:#0f172a;font-size:13px;text-align:right;">${paymentStatusLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">Phone</td>
                    <td style="padding:8px 0;color:#0f172a;font-size:13px;text-align:right;">${phoneNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">Shipping Address</td>
                    <td style="padding:8px 0;color:#0f172a;font-size:13px;text-align:right;">${shippingAddress}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;font-size:13px;">City</td>
                    <td style="padding:8px 0;color:#0f172a;font-size:13px;text-align:right;">${shippingCity}</td>
                  </tr>
                  ${couponRow}
                  ${notesRow}
                </tbody>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                <thead>
                  <tr style="background-color:#f0fdf4;">
                    <th style="padding:10px 8px;text-align:center;color:#166534;font-size:13px;">#</th>
                    <th style="padding:10px 8px;text-align:left;color:#166534;font-size:13px;">Item</th>
                    <th style="padding:10px 8px;text-align:center;color:#166534;font-size:13px;">Qty</th>
                    <th style="padding:10px 8px;text-align:right;color:#166534;font-size:13px;">Unit Price</th>
                    <th style="padding:10px 8px;text-align:right;color:#166534;font-size:13px;">Line Total</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-top:20px;">
                <tbody>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;font-size:13px;">Subtotal</td>
                    <td style="padding:6px 0;color:#0f172a;font-size:13px;text-align:right;">PKR ${orderSubtotal.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;font-size:13px;">Discount</td>
                    <td style="padding:6px 0;color:#0f172a;font-size:13px;text-align:right;">- PKR ${orderDiscount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;font-size:13px;">Tax</td>
                    <td style="padding:6px 0;color:#0f172a;font-size:13px;text-align:right;">PKR ${orderTax.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;font-size:13px;">Shipping</td>
                    <td style="padding:6px 0;color:#0f172a;font-size:13px;text-align:right;">PKR ${orderShipping.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;font-size:16px;font-weight:bold;color:#0f172a;">Total</td>
                    <td style="padding:8px 0;font-size:16px;font-weight:bold;color:#16a34a;text-align:right;">PKR ${orderTotal.toFixed(2)}</td>
                  </tr>
                  ${codRows}
                </tbody>
              </table>
              <p style="margin:24px 0 0;color:#64748b;font-size:14px;line-height:1.6;">You can track your order status in your account dashboard.</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">&copy; ${new Date().getFullYear()} Naturanza Food. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail({
    to: customerEmail,
    subject: `Order Confirmed - ${orderNumber}`,
    html,
  });
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
router.post('/create', authenticateToken, restrictBody('shipping_address', 'phone', 'discount_amount', 'tax', 'shipping_cost', 'payment_method', 'payment_status', 'customer_name', 'customer_email', 'city', 'coupon_code', 'notes', 'address_id', 'estimated_delivery', 'payment_details'), async (req, res) => {
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

    const subtotal = calculatedSubtotal;

    const paymentMethod = normalizePaymentMethod(req.body?.payment_method);
    const allowedPaymentMethods = await getAllowedPaymentMethods(connection);

    if (!allowedPaymentMethods.has(paymentMethod)) {
      await connection.rollback();
      return res.status(400).json({
        error: 'Selected payment method is currently unavailable',
      });
    }

    // SECURITY: never trust the client-supplied payment status. Prepaid gateway
    // methods are 'paid'; COD / wallet / bank transfer stay 'pending' until an
    // admin verifies the payment. Financial totals are recomputed below.
    const PREPAID_METHODS = new Set(['online', 'card']);
    const paymentStatus = PREPAID_METHODS.has(paymentMethod) ? 'paid' : 'pending';

    const customerName = req.body?.customer_name
      ? String(req.body.customer_name).trim()
      : null;
    const customerEmail = req.body?.customer_email
      ? String(req.body.customer_email).trim().toLowerCase()
      : null;
    const city = req.body?.city ? String(req.body.city).trim() : null;
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

    // SECURITY: recompute all financials server-side; client-supplied
    // discount_amount/tax/shipping_cost are ignored. Mirrors the storefront
    // formula (total = subtotal - discount + shipping; no tax line). Discount is
    // only honoured from a currently-valid coupon; shipping comes from the city
    // fee table — the same sources the storefront reads, so totals match.
    const tax = 0;
    let discountAmount = 0;
    if (couponCode) {
      const [[coupon]] = await connection.query(
        `SELECT discount_type, discount_value, min_order_amount, max_discount, usage_limit, used_count
           FROM coupons
          WHERE code = ? AND is_active = TRUE
            AND (expiry_date IS NULL OR expiry_date > NOW())`,
        [couponCode],
      );
      if (
        coupon &&
        !(coupon.usage_limit && coupon.used_count >= coupon.usage_limit) &&
        !(coupon.min_order_amount && subtotal < safeNumber(coupon.min_order_amount))
      ) {
        if (String(coupon.discount_type) === 'percentage') {
          discountAmount = (subtotal * safeNumber(coupon.discount_value)) / 100;
          if (coupon.max_discount && discountAmount > safeNumber(coupon.max_discount)) {
            discountAmount = safeNumber(coupon.max_discount);
          }
        } else {
          discountAmount = safeNumber(coupon.discount_value);
        }
      }
    }
    discountAmount = Math.min(Math.max(0, discountAmount), subtotal);

    let shippingCost = 0;
    const freeShippingThreshold = safeNumber(adminSettings.shippingFree, 5000);
    const isCod = paymentMethod === 'cod';
    const qualifiesForFreeShipping = !isCod && (subtotal - discountAmount) >= freeShippingThreshold;
    if (city && !qualifiesForFreeShipping) {
      const [[cityFee]] = await connection.query(
        `SELECT fee FROM city_delivery_fees WHERE city_name = ? AND is_active = TRUE LIMIT 1`,
        [city],
      );
      shippingCost = cityFee ? safeNumber(cityFee.fee) : 0;
    }

    const totalAmount = Math.max(0, subtotal - discountAmount + tax + shippingCost);

    const [orderInsertResult] = await connection.query(
      `INSERT INTO orders
       (user_id, address_id, customer_name, customer_email, total_amount, subtotal, discount_amount, tax, shipping_cost,
        coupon_code, status, payment_method, payment_status, payment_details, shipping_address, city, phone,
        estimated_delivery, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`,
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

    // Stock policy:
    //   - paymentStatus === 'paid'    : prepaid (card/online). Hard-deduct now, customer is committed.
    //   - paymentStatus === 'pending' : awaiting manual verification (COD advance / wallet screenshot).
    //                                   Reserve only. Admin approval will deduct; reject/timeout releases.
    // This prevents overselling during the verification queue without locking stock forever
    // on abandoned cart-uploads.
    const shouldReserveOnly = paymentStatus === 'pending';

    if (shouldReserveOnly) {
      const reservationItems = cartItems.map((item) => ({
        product_id: item.product_id,
        quantity: safeNumber(item.quantity, 0),
      }));
      try {
        await reserveStockOnConnection(connection, orderId, reservationItems);
      } catch (reserveErr) {
        await connection.rollback();
        if (reserveErr.code === 'INSUFFICIENT_STOCK') {
          return res.status(409).json({
            error: `Insufficient stock for product ${reserveErr.productId}`,
            productId: reserveErr.productId,
            available: reserveErr.available,
            requested: reserveErr.requested,
          });
        }
        throw reserveErr;
      }

      // No inventory_movements row here on purpose — stock_quantity isn't moving yet,
      // and the stock_reservations row is the authoritative audit trail until admin
      // approval converts it to a real movement.
    } else {
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

    const custEmail = order?.customer_email || customerEmail;
    if (custEmail) {
      setImmediate(() => {
        sendCustomerOrderConfirmation({
          order,
          orderId,
          customerEmail: custEmail,
          customerName: order?.customer_name || customerName,
          totalAmount,
          items: cartItems,
        }).catch((err) => console.error("Failed to send customer confirmation email:", err));
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
    console.error('[orders] create order failed:', {
      userId: req.user?.id,
      code: error?.code,
      errno: error?.errno,
      sqlMessage: error?.sqlMessage,
      message: error?.message,
    });
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
    const adminSettings = await getAdminSettings(db.promise());
    const companyOverrides = {
      ...(adminSettings.storeName ? { legalName: adminSettings.storeName } : {}),
      ...(adminSettings.storeEmail ? { email: adminSettings.storeEmail } : {}),
      ...(adminSettings.storePhone ? { phone: adminSettings.storePhone } : {}),
      // From-address tracks the admin's editable store address (same source the
      // storefront uses), so changing it in the dashboard updates new invoices.
      ...(adminSettings.address ? { officeAddress: adminSettings.address } : {}),
    };

    // Amount paid = approved payment verifications (COD advance / prepaid / final
    // collection). Balance Due is what is still pending (e.g. COD to collect).
    const [[paidRow]] = await db.promise().query(
      `SELECT COALESCE(SUM(amount), 0) AS paid
         FROM advance_payment_verifications
        WHERE order_id = ? AND status = 'approved'`,
      [orderId],
    );
    const paymentStatus = String(order.payment_status || 'pending').toLowerCase();
    const isCodOrder = String(order.payment_method || '').toLowerCase() === 'cod';
    const orderTotal = Number(order.total_amount) || 0;
    let amountPaid = Number(paidRow.paid) || 0;
    // Keep the invoice's paid/balance in lockstep with the order's payment status
    // so it updates the moment the admin (or the Payments flow) changes it.
    if (paymentStatus === 'paid') {
      amountPaid = orderTotal;
    } else if (paymentStatus === 'partial' && amountPaid <= 0) {
      // Advance paid but no verification row carried the amount — fall back to the
      // shipping advance so a COD invoice still shows the advance/balance split.
      amountPaid = Math.min(orderTotal, Number(order.shipping_cost) || 0);
    } else if (paymentStatus === 'pending' || paymentStatus === 'failed') {
      amountPaid = 0;
    }
    amountPaid = Math.min(Math.max(0, amountPaid), orderTotal);
    const balanceDue = Math.max(0, orderTotal - amountPaid);

    const pdfBuffer = await createInvoicePdfBuffer(order, {
      currency: adminSettings.currency || 'PKR',
      company: companyOverrides,
      amountPaid,
      balanceDue,
      paymentStatus,
      isCod: isCodOrder,
    });
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
router.put('/:id/cancel', authenticateToken, restrictBody(), async (req, res) => {
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
router.put('/:id/shipment', authenticateToken, isAdmin, restrictBody('courier_name', 'tracking_number', 'shipment_status', 'estimated_delivery', 'metadata'), async (req, res) => {
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
router.put('/:id/status', authenticateToken, isAdmin, restrictBody('status', 'payment_status', 'note', 'courier_name', 'tracking_number', 'estimated_delivery'), async (req, res) => {
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

    // COD two-stage: when admin marks a COD order as 'delivered' for the
    // first time, refuse if stage-1 advance shipping payment isn't approved
    // (payment_status would still be 'pending'). Otherwise auto-insert the
    // pending stage-2 verification so admin can confirm cash collection.
    const isCodOrder = String(order.payment_method || '').toLowerCase() === 'cod';
    const becameDelivered = nextStatusRaw === 'delivered' && order.status !== 'delivered';

    if (isCodOrder && becameDelivered) {
      if (currentPaymentStatus !== 'partial') {
        await connection.rollback();
        return res.status(409).json({
          error: 'Cannot mark COD order delivered: advance shipping payment must be approved first.',
          code: 'STAGE_ONE_NOT_APPROVED',
        });
      }

      const totalAmount = Number(order.total_amount) || 0;
      const shippingCost = Number(order.shipping_cost) || 0;
      const stage2Amount = Math.max(0, totalAmount - shippingCost);

      // INSERT IGNORE + UNIQUE(order_id, verification_stage) keeps this idempotent
      // when admin clicks "Mark delivered" twice or two admins race.
      await connection.query(
        `INSERT IGNORE INTO advance_payment_verifications
           (order_id, customer_name, customer_phone, amount, payment_method,
            verification_stage, status)
         VALUES (?, ?, ?, ?, 'cod', 'final_collection', 'pending')`,
        [
          String(orderId),
          order.customer_name || 'Customer',
          order.phone || null,
          stage2Amount,
        ],
      );
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

    // Only notify the customer when the order status actually changed — saving
    // the same status again must not spam a duplicate notification.
    const orderStatusChanged = nextStatusRaw !== String(order.status || '').toLowerCase();
    if (orderStatusChanged) {
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
    }

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
