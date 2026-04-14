const { dbPool } = require("../config/db");
const { createSlug } = require("../utils/slugify");

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

const listActiveCategories = async () => {
  const [rows] = await dbPool.query(
    "SELECT * FROM categories WHERE is_active = TRUE ORDER BY name ASC",
  );
  return rows;
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
  const slug = await generateUniqueSlug(payload.slug || name);

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
    updates.push("name = ?");
    params.push(String(payload.name || "").trim());

    if (!hasOwn("slug")) {
      const nextSlug = await generateUniqueSlug(payload.name || existing.name, categoryId);
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
  listActiveCategories,
  findById,
  createCategory,
  updateCategory,
  deleteById,
};
