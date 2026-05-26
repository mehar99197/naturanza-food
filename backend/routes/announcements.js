const express = require("express");
const { dbPool } = require("../config/db");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const { restrictBody } = require("../middleware/security");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

const VALID_TYPES = new Set([
  "info",
  "success",
  "warning",
  "danger",
  "promotion",
]);

const normalizeBoolean = (value, fallback = true) => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const normalizeTextField = (value) => String(value || "").trim();

const normalizeType = (value = "info") => {
  const normalized = String(value || "info")
    .trim()
    .toLowerCase();

  return VALID_TYPES.has(normalized) ? normalized : null;
};

const normalizeDateTime = (value, fieldName) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replace("T", " ");
  const withSeconds =
    normalized.length === 16 ? `${normalized}:00` : normalized;
  const parsed = new Date(withSeconds.replace(" ", "T"));

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid datetime`);
  }

  return withSeconds;
};

const ensureDateRangeIsValid = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return;
  }

  const startValue = new Date(startDate.replace(" ", "T")).getTime();
  const endValue = new Date(endDate.replace(" ", "T")).getTime();

  if (endValue < startValue) {
    throw new Error("end_date must be greater than or equal to start_date");
  }
};

const requireAdmin = [authenticateToken, isAdmin];

router.get(
  "/active",
  asyncHandler(async (req, res) => {
    const [rows] = await dbPool.query(
      `SELECT *
       FROM announcements
       WHERE is_active = TRUE
         AND (start_date IS NULL OR start_date <= NOW())
         AND (end_date IS NULL OR end_date >= NOW())
       ORDER BY COALESCE(start_date, created_at) DESC, created_at DESC`,
    );

    res.json(rows);
  }),
);

router.get(
  "/",
  ...requireAdmin,
  asyncHandler(async (req, res) => {
    const [rows] = await dbPool.query(
      `SELECT *
       FROM announcements
       ORDER BY created_at DESC, id DESC`,
    );

    res.json(rows);
  }),
);

router.post(
  "/",
  ...requireAdmin,
  restrictBody(
    "title",
    "message",
    "type",
    "is_active",
    "start_date",
    "end_date",
  ),
  asyncHandler(async (req, res) => {
    const title = normalizeTextField(req.body.title);
    const message = normalizeTextField(req.body.message);
    const type = normalizeType(req.body.type || "info");
    const isActive = normalizeBoolean(req.body.is_active, true);
    const startDate = normalizeDateTime(req.body.start_date, "start_date");
    const endDate = normalizeDateTime(req.body.end_date, "end_date");

    if (!title || !message) {
      return res
        .status(400)
        .json({ error: "title and message are required" });
    }

    if (!type) {
      return res.status(400).json({
        error:
          'type must be one of "info", "success", "warning", "danger", or "promotion"',
      });
    }

    try {
      ensureDateRangeIsValid(startDate, endDate);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const [result] = await dbPool.query(
      `INSERT INTO announcements
       (title, message, type, is_active, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, message, type, isActive, startDate ?? null, endDate ?? null],
    );

    const [rows] = await dbPool.query(
      "SELECT * FROM announcements WHERE id = ? LIMIT 1",
      [result.insertId],
    );

    res.status(201).json({
      message: "Announcement created successfully",
      announcement: rows[0],
    });
  }),
);

router.put(
  "/:id",
  ...requireAdmin,
  restrictBody(
    "title",
    "message",
    "type",
    "is_active",
    "start_date",
    "end_date",
  ),
  asyncHandler(async (req, res) => {
    const announcementId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(announcementId) || announcementId <= 0) {
      return res.status(400).json({ error: "Invalid announcement id" });
    }

    const [existingRows] = await dbPool.query(
      "SELECT * FROM announcements WHERE id = ? LIMIT 1",
      [announcementId],
    );

    if (!existingRows.length) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    const existing = existingRows[0];
    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(req.body, "title")) {
      const title = normalizeTextField(req.body.title);
      if (!title) {
        return res.status(400).json({ error: "title cannot be empty" });
      }
      updates.push("title = ?");
      values.push(title);
      existing.title = title;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "message")) {
      const message = normalizeTextField(req.body.message);
      if (!message) {
        return res.status(400).json({ error: "message cannot be empty" });
      }
      updates.push("message = ?");
      values.push(message);
      existing.message = message;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "type")) {
      const type = normalizeType(req.body.type);
      if (!type) {
        return res.status(400).json({
          error:
            'type must be one of "info", "success", "warning", "danger", or "promotion"',
        });
      }
      updates.push("type = ?");
      values.push(type);
      existing.type = type;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "is_active")) {
      const isActive = normalizeBoolean(req.body.is_active, true);
      updates.push("is_active = ?");
      values.push(isActive);
      existing.is_active = isActive;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "start_date")) {
      let startDate;
      try {
        startDate = normalizeDateTime(req.body.start_date, "start_date");
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      updates.push("start_date = ?");
      values.push(startDate ?? null);
      existing.start_date = startDate ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "end_date")) {
      let endDate;
      try {
        endDate = normalizeDateTime(req.body.end_date, "end_date");
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      updates.push("end_date = ?");
      values.push(endDate ?? null);
      existing.end_date = endDate ?? null;
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No valid fields provided for update" });
    }

    try {
      ensureDateRangeIsValid(existing.start_date, existing.end_date);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    values.push(announcementId);

    await dbPool.query(
      `UPDATE announcements
       SET ${updates.join(", ")}
       WHERE id = ?`,
      values,
    );

    const [rows] = await dbPool.query(
      "SELECT * FROM announcements WHERE id = ? LIMIT 1",
      [announcementId],
    );

    res.json({
      message: "Announcement updated successfully",
      announcement: rows[0],
    });
  }),
);

router.delete(
  "/:id",
  ...requireAdmin,
  asyncHandler(async (req, res) => {
    const announcementId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(announcementId) || announcementId <= 0) {
      return res.status(400).json({ error: "Invalid announcement id" });
    }

    const [result] = await dbPool.query(
      "DELETE FROM announcements WHERE id = ?",
      [announcementId],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    res.json({ message: "Announcement deleted successfully" });
  }),
);

module.exports = router;
