const productModel = require("../models/productModel");

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const updated = await productModel.updateProduct(req.params.id, req.body || {});

  if (!updated) {
    return res.status(404).json({ error: "Product not found" });
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

  const updated = await productModel.updateStock(
    req.params.id,
    stockQuantity,
    req.user?.id,
  );

  if (!updated) {
    return res.status(404).json({ error: "Product not found" });
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
