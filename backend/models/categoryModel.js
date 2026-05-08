const { dbPool } = require("../config/db");
const { createSlug } = require("../utils/slugify");

const CATEGORY_TYPES = new Set(["shop", "shop_by_category", "both"]);

let categoryTypeColumnState = {
  checked: false,
  exists: false,
};

const createModelError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const normalizeCategoryType = (value, fallback = "both") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (!CATEGORY_TYPES.has(normalized)) {
    return null;
  }

  return normalized;
};

const hasCategoryTypeColumn = async () => {
  if (categoryTypeColumnState.checked) {
    return categoryTypeColumnState.exists;
  }

  const [columns] = await dbPool.query("SHOW COLUMNS FROM categories LIKE 'category_type'");
  categoryTypeColumnState = {
    checked: true,
    exists: columns.length > 0,
  };

  return categoryTypeColumnState.exists;
};

const findByNormalizedName = async (name, excludeCategoryId = null) => {
  const query = excludeCategoryId
    ? `SELECT id, name
       FROM categories
       WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
         AND id <> ?
       LIMIT 1`
    : `SELECT id, name
       FROM categories
       WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
       LIMIT 1`;

  const params = excludeCategoryId ? [name, excludeCategoryId] : [name];
  const [rows] = await dbPool.query(query, params);
  return rows[0] || null;
};

const generateUniqueSlug = async (baseSlug, categoryId = null) => {
  const base = createSlug(baseSlug, "category");
  let candidate = base;
  let suffix = 1;

  while (true) {
    const query = categoryId
      ? "SELECT id FROM categories WHERE slug = ? AND id <> ? LIMIT 1"
      : "SELECT id FROM categories WHERE slug = ? LIMIT 1";
    const params = categoryId ? [candidate, categoryId] : [candidate];

    const [rows] = await dbPool.query(query, params);
    if (!rows.length) {
      return candidate;
    }

    candidate = `${base}-${suffix}`.slice(0, 120);
    suffix += 1;
  }
};

const listCategories = async ({ includeInactive = false, categoryType = null } = {}) => {
  const filters = [];
  const params = [];

  if (!includeInactive) {
    filters.push("is_active = TRUE");
  }

  const requestedType = normalizeCategoryType(categoryType, null);
  const categoryTypeAvailable = await hasCategoryTypeColumn();

  if (categoryTypeAvailable && requestedType) {
    if (requestedType === "shop") {
      filters.push("category_type IN (?, ?)");
      params.push("shop", "both");
    } else if (requestedType === "shop_by_category") {
      filters.push("category_type IN (?, ?)");
      params.push("shop_by_category", "both");
    } else {
      filters.push("category_type = ?");
      params.push("both");
    }
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const query = `SELECT * FROM categories ${whereClause} ORDER BY name ASC`;
  const [rows] = await dbPool.query(query, params);
  return rows;
};

const listActiveCategories = async () => {
  return listCategories({ includeInactive: false });
};

const findById = async (categoryId) => {
  const [rows] = await dbPool.query(
    "SELECT * FROM categories WHERE id = ? LIMIT 1",
    [categoryId],
  );

  return rows[0] || null;
};

const createCategory = async (payload = {}) => {
  const name = String(payload.name || "").trim();

  if (!name) {
    throw createModelError("Category name is required", 400, "CATEGORY_NAME_REQUIRED");
  }

  const duplicateCategory = await findByNormalizedName(name);
  if (duplicateCategory) {
    throw createModelError(
      "Category with this name already exists",
      409,
      "CATEGORY_NAME_EXISTS",
    );
  }

  const slug = await generateUniqueSlug(payload.slug || name);

  const categoryTypeAvailable = await hasCategoryTypeColumn();
  const normalizedType = normalizeCategoryType(payload.category_type, "both");

  if (categoryTypeAvailable && !normalizedType) {
    throw createModelError(
      "Invalid category type. Allowed values: shop, shop_by_category, both",
      400,
      "CATEGORY_TYPE_INVALID",
    );
  }

  if (categoryTypeAvailable) {
    const [result] = await dbPool.query(
      `INSERT INTO categories (name, slug, description, image_url, category_type, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        slug,
        payload.description || null,
        payload.image_url || null,
        normalizedType,
        payload.is_active === undefined ? true : Boolean(payload.is_active),
      ],
    );

    return result.insertId;
  }

  const [result] = await dbPool.query(
    `INSERT INTO categories (name, slug, description, image_url, is_active)
     VALUES (?, ?, ?, ?, ?)`,
    [
      name,
      slug,
      payload.description || null,
      payload.image_url || null,
      payload.is_active === undefined ? true : Boolean(payload.is_active),
    ],
  );

  return result.insertId;
};

const updateCategory = async (categoryId, payload = {}) => {
  const categoryTypeAvailable = await hasCategoryTypeColumn();
  const [existingRows] = await dbPool.query(
    "SELECT id, name FROM categories WHERE id = ? LIMIT 1",
    [categoryId],
  );

  if (!existingRows.length) {
    return false;
  }

  const existing = existingRows[0];
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(payload, key);

  const updates = [];
  const params = [];

  if (hasOwn("name")) {
    const nextName = String(payload.name || "").trim();

    if (!nextName) {
      throw createModelError("Category name is required", 400, "CATEGORY_NAME_REQUIRED");
    }

    const duplicateCategory = await findByNormalizedName(nextName, categoryId);
    if (duplicateCategory) {
      throw createModelError(
        "Category with this name already exists",
        409,
        "CATEGORY_NAME_EXISTS",
      );
    }

    updates.push("name = ?");
    params.push(nextName);

    if (!hasOwn("slug")) {
      const nextSlug = await generateUniqueSlug(nextName || existing.name, categoryId);
      updates.push("slug = ?");
      params.push(nextSlug);
    }
  }

  if (hasOwn("slug")) {
    const slug = await generateUniqueSlug(payload.slug || existing.name, categoryId);
    updates.push("slug = ?");
    params.push(slug);
  }

  const scalarFields = [
    ["description", "description = ?", (value) => value || null],
    ["image_url", "image_url = ?", (value) => value || null],
    ["is_active", "is_active = ?", (value) => Boolean(value)],
  ];

  if (categoryTypeAvailable && hasOwn("category_type")) {
    const normalizedType = normalizeCategoryType(payload.category_type, null);

    if (!normalizedType) {
      throw createModelError(
        "Invalid category type. Allowed values: shop, shop_by_category, both",
        400,
        "CATEGORY_TYPE_INVALID",
      );
    }

    updates.push("category_type = ?");
    params.push(normalizedType);
  }

  for (const [key, clause, formatter] of scalarFields) {
    if (!hasOwn(key)) {
      continue;
    }

    updates.push(clause);
    params.push(formatter(payload[key]));
  }

  if (updates.length === 0) {
    return true;
  }

  params.push(categoryId);

  await dbPool.query(`UPDATE categories SET ${updates.join(", ")} WHERE id = ?`, params);
  return true;
};

const deleteById = async (categoryId) => {
  const [result] = await dbPool.query("DELETE FROM categories WHERE id = ?", [categoryId]);
  return result.affectedRows > 0;
};

module.exports = {
  listCategories,
  listActiveCategories,
  findById,
  createCategory,
  updateCategory,
  deleteById,
};
