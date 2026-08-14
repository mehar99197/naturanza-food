const productModel = require("../models/productModel");
const { db } = require("../config/db");
const { getAdminRecipients } = require("../utils/adminNotifications");
const { sendEmail } = require("../utils/emailService");

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isAdminRequest = (req) =>
  String(req?.user?.role || "").trim().toLowerCase() === "admin";

// Storefront responses only need availability, not the exact inventory ledger
// or internal identifiers. Admin requests keep the complete product record.
const toPublicProduct = (product = {}) => {
  const publicProduct = { ...product };
  const stockQuantity = Number(publicProduct.stock_quantity);
  const reservedStock = Number(publicProduct.reserved_stock);

  delete publicProduct.stock_quantity;
  delete publicProduct.reserved_stock;
  delete publicProduct.barcode;
  delete publicProduct.qr_code_url;
  delete publicProduct.created_at;
  delete publicProduct.updated_at;

  publicProduct.is_in_stock =
    Number.isFinite(stockQuantity) &&
    stockQuantity - (Number.isFinite(reservedStock) ? reservedStock : 0) > 0;

  if (Array.isArray(publicProduct.images)) {
    publicProduct.images = publicProduct.images.map((image) => ({
      image_url: image?.image_url || null,
      alt_text: image?.alt_text || null,
    }));
  }

  return publicProduct;
};

const serializeProducts = (products, req) =>
  isAdminRequest(req) ? products : products.map(toPublicProduct);

const { escapeHtml } = require('../utils/htmlEscape');

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
           <p style="margin: 0 0 10px;">${escapeHtml(lowStockEvent.product_name)} is low on stock.</p>
           <p style="margin: 0;">Remaining: ${escapeHtml(lowStockEvent.stock_quantity)}</p>
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
  res.json({ data: serializeProducts(products, req) });
};

const getProducts = async (req, res) => {
  const adminRequest = isAdminRequest(req);
  const products = await productModel.listProducts({
    category: req.query.category,
    search: req.query.search,
    is_organic: req.query.is_organic,
    is_featured: req.query.is_featured,
    featuredAlias: req.query.featured,
    limit: req.query.limit || 50,
    offset: req.query.offset || 0,
    includeInactive:
      req.query.includeInactive === 'true' &&
      adminRequest,
  });

  res.json({ data: adminRequest ? products : products.map(toPublicProduct) });
};

const getProductById = async (req, res) => {
  const product = await productModel.findById(req.params.id);

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  return res.json(isAdminRequest(req) ? product : toPublicProduct(product));
};

// POS lookup: a store's scanner reads the label and resolves it to a product.
const getProductByBarcode = async (req, res) => {
  const product = await productModel.findByBarcode(req.params.code);

  if (!product) {
    return res.status(404).json({ error: "No product matches that barcode" });
  }

  return res.json(product);
};

const createProduct = async (req, res) => {
  const payload = req.body || {};

  if (
    !String(payload.name || "").trim() ||
    payload.price === undefined ||
    payload.price === null
  ) {
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
  toPublicProduct,
  getFeaturedProducts,
  getProducts,
  getProductById,
  getProductByBarcode,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
};
