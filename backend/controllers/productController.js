const productModel = require("../models/productModel");
const { db } = require("../config/db");
const { getAdminRecipients } = require("../utils/adminNotifications");
const { sendEmail } = require("../utils/emailService");

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const queueLowStockEmail = (lowStockEvent, excludeUserId) => {
  if (!lowStockEvent) {
    return;
  }

  setImmediate(async () => {
    try {
      const recipients = await getAdminRecipients(db.promise(), excludeUserId);
      const emailList = recipients.map((row) => row.email).filter(Boolean);

      if (!emailList.length) {
        return;
      }

      const subject = "Low stock alert";
      const html = `
        <div style="font-family: Arial, sans-serif; color: #1f2937;">
          <h2 style="margin: 0 0 8px; color: #0f172a;">Low Stock Alert</h2>
          <p style="margin: 0 0 10px;">${lowStockEvent.product_name} is low on stock.</p>
          <p style="margin: 0;">Remaining: ${lowStockEvent.stock_quantity}</p>
        </div>
      `;

      await sendEmail({ to: emailList.join(","), subject, html });
    } catch {
      // Ignore email failures to avoid blocking product updates.
    }
  });
};

const getFeaturedProducts = async (req, res) => {
  const products = await productModel.listFeaturedProducts(10);
  res.json({ data: products });
};

const getProducts = async (req, res) => {
  const products = await productModel.listProducts({
    category: req.query.category,
    search: req.query.search,
    is_organic: req.query.is_organic,
    is_featured: req.query.is_featured,
    featuredAlias: req.query.featured,
    limit: req.query.limit || 50,
    offset: req.query.offset || 0,
    includeInactive: req.query.includeInactive === 'true',
  });

  res.json({ data: products });
};

const getProductById = async (req, res) => {
  const product = await productModel.findById(req.params.id);

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  return res.json(product);
};

const createProduct = async (req, res) => {
  const payload = req.body || {};

  if (!payload.name || payload.price === undefined || payload.price === null) {
    return res.status(400).json({ error: "Product name and price are required" });
  }

  const productId = await productModel.createProduct(payload);

  return res.status(201).json({
    message: "Product created successfully",
    productId,
  });
};

const updateProduct = async (req, res) => {
  const result = await productModel.updateProduct(req.params.id, req.body || {});

  if (!result || result.updated === false) {
    return res.status(404).json({ error: "Product not found" });
  }

  if (result.shouldSendLowStockEmail && result.lowStockEvent) {
    queueLowStockEmail(result.lowStockEvent, req.user?.id);
  }

  return res.json({ message: "Product updated successfully" });
};

const deleteProduct = async (req, res) => {
  const deleted = await productModel.deleteById(req.params.id);

  if (!deleted) {
    return res.status(404).json({ error: "Product not found" });
  }

  return res.json({ message: "Product deleted successfully" });
};

const updateStock = async (req, res) => {
  const stockQuantity = toNumber(req.body?.stock_quantity, Number.NaN);

  if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
    return res.status(400).json({ error: "Valid stock_quantity is required" });
  }

  const result = await productModel.updateStock(
    req.params.id,
    stockQuantity,
    req.user?.id,
  );

  if (!result || result.updated === false) {
    return res.status(404).json({ error: "Product not found" });
  }

  if (result.shouldSendLowStockEmail && result.lowStockEvent) {
    queueLowStockEmail(result.lowStockEvent, req.user?.id);
  }

  return res.json({ message: "Stock updated successfully" });
};

module.exports = {
  getFeaturedProducts,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
};
