---
name: adding-api-features
description: Scaffold a new REST API feature/resource end-to-end in the Naturanza Food backend (Node.js/Express 5 + MySQL). Use when adding a new endpoint, resource, or CRUD entity that spans routes/, controllers/, and models/. Generates code matching the project's layered route→controller→model conventions with asyncHandler, restrictBody, zod, and parameterized SQL.
---

# Adding an API feature

Build a new resource across the three layers, matching the canonical reference trio:
`routes/categories.js`, `controllers/categoryController.js`, `models/categoryModel.js`.

## Before writing code

1. Confirm the resource name (singular `thing` / plural `things`) and its DB table + columns. If the
   table doesn't exist yet, use the `/creating-db-migrations` skill first.
2. List the exact mutable columns (for `restrictBody` + INSERT/UPDATE) and which routes are
   public vs. admin-only.
3. Read the reference trio above to mirror their style exactly.

## Steps

### 1. Model — `models/<thing>Model.js`
Owns all SQL. Parameterized queries only. Pattern:

```js
const { dbPool } = require("../config/db");

const createModelError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const listThings = async ({ includeInactive = false } = {}) => {
  const where = includeInactive ? "" : "WHERE is_active = TRUE";
  const [rows] = await dbPool.query(`SELECT * FROM things ${where} ORDER BY id DESC`);
  return rows;
};

const findById = async (id) => {
  const [rows] = await dbPool.query("SELECT * FROM things WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
};

const createThing = async (payload = {}) => {
  const name = String(payload.name || "").trim();
  if (!name) throw createModelError("Name is required", 400, "THING_NAME_REQUIRED");
  const [result] = await dbPool.query(
    "INSERT INTO things (name, is_active) VALUES (?, ?)",
    [name, payload.is_active === undefined ? true : Boolean(payload.is_active)],
  );
  return result.insertId;
};

const updateThing = async (id, payload = {}) => {
  const updates = [];
  const params = [];
  const hasOwn = (k) => Object.prototype.hasOwnProperty.call(payload, k);
  if (hasOwn("name")) { updates.push("name = ?"); params.push(String(payload.name).trim()); }
  if (hasOwn("is_active")) { updates.push("is_active = ?"); params.push(Boolean(payload.is_active)); }
  if (!updates.length) return true;
  params.push(id);
  const [result] = await dbPool.query(`UPDATE things SET ${updates.join(", ")} WHERE id = ?`, params);
  return result.affectedRows > 0;
};

const deleteById = async (id) => {
  const [result] = await dbPool.query("DELETE FROM things WHERE id = ?", [id]);
  return result.affectedRows > 0;
};

module.exports = { listThings, findById, createThing, updateThing, deleteById };
```

- Wrap atomic multi-statement writes in `withTransaction(fn)` from `config/db.js`.
- Use a `SHOW COLUMNS ... LIKE` cached guard for columns that may be absent on legacy DBs (see `categoryModel.js`).

### 2. Controller — `controllers/<thing>Controller.js`
Thin. No try/catch (asyncHandler handles errors). Return `res.status(n).json(...)`.

```js
const thingModel = require("../models/thingModel");

const getThings = async (req, res) => {
  const includeInactive = String(req.query?.include_inactive || "false") === "true";
  return res.json(await thingModel.listThings({ includeInactive }));
};

const getThingById = async (req, res) => {
  const thing = await thingModel.findById(req.params.id);
  if (!thing) return res.status(404).json({ error: "Thing not found" });
  return res.json(thing);
};

const createThing = async (req, res) => {
  if (!req.body?.name) return res.status(400).json({ error: "Name is required" });
  const thingId = await thingModel.createThing(req.body);
  return res.status(201).json({ message: "Thing created successfully", thingId });
};

const updateThing = async (req, res) => {
  const ok = await thingModel.updateThing(req.params.id, req.body || {});
  if (!ok) return res.status(404).json({ error: "Thing not found" });
  return res.json({ message: "Thing updated successfully" });
};

const deleteThing = async (req, res) => {
  const ok = await thingModel.deleteById(req.params.id);
  if (!ok) return res.status(404).json({ error: "Thing not found" });
  return res.json({ message: "Thing deleted successfully" });
};

module.exports = { getThings, getThingById, createThing, updateThing, deleteThing };
```

### 3. Routes — `routes/<things>.js`
Wire middleware; wrap every handler in `asyncHandler`. List exact fields in `restrictBody`.

```js
const express = require("express");
const router = express.Router();
const { authenticateToken, isAdmin } = require("../middleware/auth");
const { restrictBody } = require("../middleware/security");
const asyncHandler = require("../middleware/asyncHandler");
const thingController = require("../controllers/thingController");

router.get("/", asyncHandler(thingController.getThings));
router.get("/:id", asyncHandler(thingController.getThingById));
router.post("/", authenticateToken, isAdmin, restrictBody("name", "is_active"), asyncHandler(thingController.createThing));
router.put("/:id", authenticateToken, isAdmin, restrictBody("name", "is_active"), asyncHandler(thingController.updateThing));
router.delete("/:id", authenticateToken, isAdmin, asyncHandler(thingController.deleteThing));

module.exports = router;
```

### 4. Register in `index.js`
Add alongside the other route mounts: `app.use("/api/things", require("./routes/things"));`

### 5. Validation (auth-sensitive bodies)
For auth/security-sensitive payloads, add a zod schema under `validation/` (see `validation/authSchemas.js`)
and validate in the controller before calling the model.

## Finish

- Run `/reviewing-code-quality` before declaring done.
- Smoke test with curl against `http://localhost:5000/api/things` (server: `npm run dev`).
  Admin routes need a Bearer token — log in first via `/api/auth/login`.
- Remove any scaffold code you didn't end up using (dead-code rule).
