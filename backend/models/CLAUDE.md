# models/ — conventions

Models own **all SQL and data-integrity rules**. They are the only layer that touches `dbPool`.
Reference: `models/categoryModel.js`.

## Skeleton

```js
const { dbPool } = require("../config/db");

const createModelError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const findById = async (id) => {
  const [rows] = await dbPool.query("SELECT * FROM things WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
};

const createThing = async (payload = {}) => {
  const name = String(payload.name || "").trim();
  if (!name) {
    throw createModelError("Name is required", 400, "THING_NAME_REQUIRED");
  }
  const [result] = await dbPool.query(
    "INSERT INTO things (name, is_active) VALUES (?, ?)",
    [name, payload.is_active === undefined ? true : Boolean(payload.is_active)],
  );
  return result.insertId;
};

module.exports = { findById, createThing };
```

## Rules

- **Parameterized queries only:** `dbPool.query(sql, [params])`. Never build SQL with string concatenation/interpolation of user input.
- **Errors:** throw `createModelError(message, statusCode, code)` for domain failures (validation, 404, 409 conflicts). Define the helper per file (matches existing models).
- **Return conventions:** reads → `rows[0] || null` or `rows`; inserts → `result.insertId`; updates/deletes → boolean from `result.affectedRows > 0` (or `true` when a no-op update is acceptable).
- **Transactions:** wrap multi-statement writes that must be atomic in `withTransaction(async (conn) => { ... })` from `config/db.js`.
- **Schema-compat guards:** when a column may not exist on legacy DBs, check first (`SHOW COLUMNS FROM t LIKE 'col'`) and cache the result — see `hasCategoryTypeColumn` in `categoryModel.js`.
- Normalize/trim inputs and enforce enums and uniqueness here, not in the controller.
- `module.exports = { ... }` — export a flat object of named functions.
