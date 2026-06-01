const { dbPool } = require("../config/db");
const { createSlug } = require("../utils/slugify");

const createModelError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

// Public-facing field list — aliased so the storefront keeps its existing shape
// (post.image, post.readTime, post.date).
const PUBLIC_FIELDS = `
  id, slug, title, excerpt, content, author, category,
  image_url AS image, read_time AS readTime, keywords,
  featured, DATE_FORMAT(published_at, '%Y-%m-%d') AS date`;

const listPublished = async ({ category = null } = {}) => {
  let sql = `SELECT ${PUBLIC_FIELDS} FROM blog_posts WHERE is_published = TRUE`;
  const params = [];
  if (category) {
    sql += " AND LOWER(category) = LOWER(?)";
    params.push(String(category).trim());
  }
  sql += " ORDER BY published_at DESC";
  const [rows] = await dbPool.query(sql, params);
  return rows;
};

const findBySlug = async (slug) => {
  const [rows] = await dbPool.query(
    `SELECT ${PUBLIC_FIELDS} FROM blog_posts WHERE slug = ? AND is_published = TRUE LIMIT 1`,
    [String(slug || "").trim()],
  );
  return rows[0] || null;
};

// Admin: every post (drafts included), raw columns for editing.
const listAll = async () => {
  const [rows] = await dbPool.query(
    `SELECT id, slug, title, excerpt, content, author, category, image_url, read_time,
            keywords, featured, is_published,
            DATE_FORMAT(published_at, '%Y-%m-%d') AS date, created_at, updated_at
       FROM blog_posts
      ORDER BY published_at DESC`,
  );
  return rows;
};

const generateUniqueSlug = async (baseValue, excludeId = null) => {
  const base = createSlug(baseValue, "post");
  let candidate = base;
  let suffix = 1;
  while (true) {
    const query = excludeId
      ? "SELECT id FROM blog_posts WHERE slug = ? AND id <> ? LIMIT 1"
      : "SELECT id FROM blog_posts WHERE slug = ? LIMIT 1";
    const params = excludeId ? [candidate, excludeId] : [candidate];
    const [rows] = await dbPool.query(query, params);
    if (!rows.length) {
      return candidate;
    }
    candidate = `${base}-${suffix}`.slice(0, 190);
    suffix += 1;
  }
};

const createPost = async (payload = {}) => {
  const title = String(payload.title || "").trim();
  if (!title) {
    throw createModelError("Post title is required", 400, "BLOG_TITLE_REQUIRED");
  }
  const content = String(payload.content || "").trim();
  if (!content) {
    throw createModelError("Post content is required", 400, "BLOG_CONTENT_REQUIRED");
  }

  const slug = await generateUniqueSlug(payload.slug || title);

  const [result] = await dbPool.query(
    `INSERT INTO blog_posts
       (slug, title, excerpt, content, author, category, image_url, read_time, keywords, featured, is_published, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      slug,
      title,
      payload.excerpt ? String(payload.excerpt).trim() : null,
      content,
      payload.author ? String(payload.author).trim() : "Naturanza Food Team",
      payload.category ? String(payload.category).trim() : null,
      payload.image_url ? String(payload.image_url).trim() : null,
      payload.read_time ? String(payload.read_time).trim() : null,
      payload.keywords ? String(payload.keywords).trim() : null,
      payload.featured ? 1 : 0,
      payload.is_published === false ? 0 : 1,
    ],
  );
  return result.insertId;
};

const updatePost = async (id, payload = {}) => {
  const fields = [];
  const params = [];

  const setText = (column, value) => {
    fields.push(`${column} = ?`);
    params.push(value === undefined || value === null || value === "" ? null : String(value).trim());
  };

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    const title = String(payload.title || "").trim();
    if (!title) throw createModelError("Post title cannot be empty", 400, "BLOG_TITLE_REQUIRED");
    fields.push("title = ?");
    params.push(title);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "slug") && payload.slug) {
    const slug = await generateUniqueSlug(payload.slug, id);
    fields.push("slug = ?");
    params.push(slug);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "content")) {
    const content = String(payload.content || "").trim();
    if (!content) throw createModelError("Post content cannot be empty", 400, "BLOG_CONTENT_REQUIRED");
    fields.push("content = ?");
    params.push(content);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "excerpt")) setText("excerpt", payload.excerpt);
  if (Object.prototype.hasOwnProperty.call(payload, "author")) setText("author", payload.author);
  if (Object.prototype.hasOwnProperty.call(payload, "category")) setText("category", payload.category);
  if (Object.prototype.hasOwnProperty.call(payload, "image_url")) setText("image_url", payload.image_url);
  if (Object.prototype.hasOwnProperty.call(payload, "read_time")) setText("read_time", payload.read_time);
  if (Object.prototype.hasOwnProperty.call(payload, "keywords")) setText("keywords", payload.keywords);
  if (Object.prototype.hasOwnProperty.call(payload, "featured")) {
    fields.push("featured = ?");
    params.push(payload.featured ? 1 : 0);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "is_published")) {
    fields.push("is_published = ?");
    params.push(payload.is_published ? 1 : 0);
  }

  if (!fields.length) {
    return true;
  }

  params.push(id);
  const [result] = await dbPool.query(
    `UPDATE blog_posts SET ${fields.join(", ")} WHERE id = ?`,
    params,
  );
  return result.affectedRows > 0;
};

const deleteById = async (id) => {
  const [result] = await dbPool.query("DELETE FROM blog_posts WHERE id = ?", [id]);
  return result.affectedRows > 0;
};

module.exports = {
  listPublished,
  findBySlug,
  listAll,
  createPost,
  updatePost,
  deleteById,
};
