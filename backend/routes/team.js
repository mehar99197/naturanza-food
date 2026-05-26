const express = require("express");
const { dbPool } = require("../config/db");
const { authenticateToken, isAdmin } = require("../middleware/auth");
const { restrictBody } = require("../middleware/security");
const asyncHandler = require("../middleware/asyncHandler");
const { uploadProfileImage } = require("../middleware/upload");

const router = express.Router();

const requireAdmin = [authenticateToken, isAdmin];

const normalizeText = (value) => String(value || "").trim();

// Public: get active team members (sorted)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [rows] = await dbPool.query(
      `SELECT id, name, role, image, bio
       FROM team_members
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, id ASC`,
    );
    res.json(rows);
  }),
);

// Admin: get all team members
router.get(
  "/all",
  ...requireAdmin,
  asyncHandler(async (req, res) => {
    const [rows] = await dbPool.query(
      `SELECT *
       FROM team_members
       ORDER BY sort_order ASC, id ASC`,
    );
    res.json(rows);
  }),
);

// Admin: upload team member image
router.post(
  "/upload-image",
  ...requireAdmin,
  uploadProfileImage,
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }
    res.status(200).json({
      message: "Image uploaded successfully",
      imageUrl: req.file.url,
    });
  },
);

// Admin: create team member
router.post(
  "/",
  ...requireAdmin,
  restrictBody("name", "role", "image", "bio", "sort_order", "is_active"),
  asyncHandler(async (req, res) => {
    const name = normalizeText(req.body.name);
    const role = normalizeText(req.body.role);


    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!role) {
      return res.status(400).json({ error: "role is required" });
    }

    const image = normalizeText(req.body.image) || null;
    const bio = normalizeText(req.body.bio) || null;
    const sortOrder =
      req.body.sort_order !== undefined ? Number(req.body.sort_order) : 0;
    const isActive =
      req.body.is_active !== undefined ? Boolean(req.body.is_active) : true;

    const [result] = await dbPool.query(
      `INSERT INTO team_members (name, role, image, bio, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, role, image, bio, sortOrder, isActive],
    );

    const [rows] = await dbPool.query(
      "SELECT * FROM team_members WHERE id = ? LIMIT 1",
      [result.insertId],
    );

    res.status(201).json({
      message: "Team member created successfully",
      member: rows[0],
    });
  }),
);

// Admin: update team member
router.put(
  "/:id",
  ...requireAdmin,
  restrictBody("name", "role", "image", "bio", "sort_order", "is_active"),
  asyncHandler(async (req, res) => {
    const memberId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({ error: "Invalid team member id" });
    }

    const [existingRows] = await dbPool.query(
      "SELECT * FROM team_members WHERE id = ? LIMIT 1",
      [memberId],
    );
    if (!existingRows.length) {
      return res.status(404).json({ error: "Team member not found" });
    }

    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(req.body, "name")) {
      const name = normalizeText(req.body.name);
      if (!name) {
        return res.status(400).json({ error: "name cannot be empty" });
      }
      updates.push("name = ?");
      values.push(name);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "role")) {
      const role = normalizeText(req.body.role);
      if (!role) {
        return res.status(400).json({ error: "role cannot be empty" });
      }
      updates.push("role = ?");
      values.push(role);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "image")) {
      updates.push("image = ?");
      values.push(normalizeText(req.body.image) || null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "bio")) {
      updates.push("bio = ?");
      values.push(normalizeText(req.body.bio) || null);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "sort_order")) {
      updates.push("sort_order = ?");
      values.push(Number(req.body.sort_order));
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "is_active")) {
      updates.push("is_active = ?");
      values.push(Boolean(req.body.is_active));
    }

    if (!updates.length) {
      return res
        .status(400)
        .json({ error: "No valid fields provided for update" });
    }

    values.push(memberId);
    await dbPool.query(
      `UPDATE team_members SET ${updates.join(", ")} WHERE id = ?`,
      values,
    );

    const [rows] = await dbPool.query(
      "SELECT * FROM team_members WHERE id = ? LIMIT 1",
      [memberId],
    );

    res.json({ message: "Team member updated successfully", member: rows[0] });
  }),
);

// Admin: delete team member
router.delete(
  "/:id",
  ...requireAdmin,
  asyncHandler(async (req, res) => {
    const memberId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({ error: "Invalid team member id" });
    }

    const [result] = await dbPool.query(
      "DELETE FROM team_members WHERE id = ?",
      [memberId],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Team member not found" });
    }

    res.json({ message: "Team member deleted successfully" });
  }),
);

module.exports = router;
