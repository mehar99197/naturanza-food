const crypto = require("crypto");
const { dbPool } = require("../config/db");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createModelError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const generateToken = () => crypto.randomBytes(32).toString("hex");

const findByEmail = async (email) => {
  const [rows] = await dbPool.query(
    "SELECT * FROM newsletter_subscribers WHERE email = ? LIMIT 1",
    [normalizeEmail(email)],
  );
  return rows[0] || null;
};

const findByToken = async (token) => {
  const [rows] = await dbPool.query(
    "SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = ? LIMIT 1",
    [String(token || "").trim()],
  );
  return rows[0] || null;
};

const subscribe = async ({ email, source = "footer" }) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw createModelError("Email is required", 400, "NEWSLETTER_EMAIL_REQUIRED");
  }
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw createModelError("Invalid email address", 400, "NEWSLETTER_EMAIL_INVALID");
  }

  const existing = await findByEmail(normalizedEmail);

  if (existing && existing.status === "active") {
    return { subscriber: existing, alreadySubscribed: true, reactivated: false };
  }

  if (existing && existing.status === "unsubscribed") {
    await dbPool.query(
      `UPDATE newsletter_subscribers
       SET status = 'active',
           reactivated_at = CURRENT_TIMESTAMP,
           source = ?
       WHERE id = ?`,
      [String(source || "footer").slice(0, 40), existing.id],
    );
    const refreshed = await findByEmail(normalizedEmail);
    return { subscriber: refreshed, alreadySubscribed: false, reactivated: true };
  }

  const token = generateToken();
  const [result] = await dbPool.query(
    `INSERT INTO newsletter_subscribers (email, unsubscribe_token, source)
     VALUES (?, ?, ?)`,
    [normalizedEmail, token, String(source || "footer").slice(0, 40)],
  );

  const [rows] = await dbPool.query(
    "SELECT * FROM newsletter_subscribers WHERE id = ? LIMIT 1",
    [result.insertId],
  );

  return { subscriber: rows[0], alreadySubscribed: false, reactivated: false };
};

const unsubscribeByToken = async (token) => {
  const subscriber = await findByToken(token);
  if (!subscriber) {
    throw createModelError("Invalid unsubscribe link", 404, "NEWSLETTER_TOKEN_INVALID");
  }
  if (subscriber.status === "unsubscribed") {
    return subscriber;
  }
  await dbPool.query(
    `UPDATE newsletter_subscribers
     SET status = 'unsubscribed', unsubscribed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [subscriber.id],
  );
  return { ...subscriber, status: "unsubscribed" };
};

const listSubscribers = async ({ status = null, search = null, limit = 200 } = {}) => {
  const clauses = [];
  const params = [];

  if (status === "active" || status === "unsubscribed") {
    clauses.push("status = ?");
    params.push(status);
  }

  if (search) {
    clauses.push("email LIKE ?");
    params.push(`%${String(search).trim().toLowerCase()}%`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);

  const [rows] = await dbPool.query(
    `SELECT id, email, status, source, subscribed_at, unsubscribed_at, reactivated_at
     FROM newsletter_subscribers
     ${where}
     ORDER BY subscribed_at DESC
     LIMIT ${safeLimit}`,
    params,
  );

  return rows;
};

const countByStatus = async () => {
  const [rows] = await dbPool.query(
    `SELECT status, COUNT(*) AS total
     FROM newsletter_subscribers
     GROUP BY status`,
  );
  const counts = { active: 0, unsubscribed: 0 };
  rows.forEach((row) => {
    counts[row.status] = Number(row.total) || 0;
  });
  counts.total = counts.active + counts.unsubscribed;
  return counts;
};

const listActiveForBroadcast = async () => {
  const [rows] = await dbPool.query(
    `SELECT id, email, unsubscribe_token
     FROM newsletter_subscribers
     WHERE status = 'active'
     ORDER BY id ASC`,
  );
  return rows;
};

const deleteById = async (id) => {
  const [result] = await dbPool.query(
    "DELETE FROM newsletter_subscribers WHERE id = ?",
    [id],
  );
  return result.affectedRows > 0;
};

module.exports = {
  subscribe,
  findByEmail,
  findByToken,
  unsubscribeByToken,
  listSubscribers,
  countByStatus,
  listActiveForBroadcast,
  deleteById,
};
