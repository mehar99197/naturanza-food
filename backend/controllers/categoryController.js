const categoryModel = require("../models/categoryModel");

const getCategories = async (req, res) => {
  const categories = await categoryModel.listActiveCategories();
  res.json(categories);
};

const getCategoryById = async (req, res) => {
  const category = await categoryModel.findById(req.params.id);

  if (!category) {
    return res.status(404).json({ error: "Category not found" });
  }

  return res.json(category);
};

const createCategory = async (req, res) => {
  if (!req.body?.name) {
    return res.status(400).json({ error: "Category name is required" });
  }

  const categoryId = await categoryModel.createCategory(req.body);

  return res.status(201).json({
    message: "Category created successfully",
    categoryId,
  });
};

const updateCategory = async (req, res) => {
  const updated = await categoryModel.updateCategory(req.params.id, req.body || {});

  if (!updated) {
    return res.status(404).json({ error: "Category not found" });
  }

  return res.json({ message: "Category updated successfully" });
};

const deleteCategory = async (req, res) => {
  const deleted = await categoryModel.deleteById(req.params.id);

  if (!deleted) {
    return res.status(404).json({ error: "Category not found" });
  }

  return res.json({ message: "Category deleted successfully" });
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
