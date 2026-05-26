# routes/ — conventions

Each file is one Express router mounted under `/api/<name>` in `index.js`. Routers only **wire
middleware and delegate** — no business logic here. Reference: `routes/categories.js`.

## Skeleton

```js
const express = require("express");
const router = express.Router();
const { authenticateToken, isAdmin } = require("../middleware/auth");
const { restrictBody } = require("../middleware/security");
const asyncHandler = require("../middleware/asyncHandler");
const thingController = require("../controllers/thingController");

router.get("/", asyncHandler(thingController.getThings));
router.get("/:id", asyncHandler(thingController.getThingById));

router.post(
  "/",
  authenticateToken,
  isAdmin,
  restrictBody("name", "price", "is_active"),   // whitelist EVERY accepted field
  asyncHandler(thingController.createThing),
);

module.exports = router;
```

## Rules

- **Always** wrap the controller in `asyncHandler(...)` — it forwards thrown errors to `errorHandler`.
- **Middleware order:** `authenticateToken` → role guard (`isAdmin` / `requireSuperAdmin`) → `restrictBody(...)` → `asyncHandler(controller)`.
- **`restrictBody(...fields)`** is required on every POST/PUT/PATCH that accepts a body — it blocks mass assignment. List the exact columns the model accepts.
- **Public reads** (`GET`) usually skip auth; use `optionalAuthenticateToken` when a route behaves differently for logged-in users.
- File uploads: use the multer middleware from `middleware/upload.js` (e.g. `uploadCategoryImage`) before the handler; it attaches `req.file` (already compressed to WebP).
- After creating a router, **register it in `index.js`**: `app.use("/api/things", require("./routes/things"))`.
- Rate limiting + CSRF are applied globally in `index.js`; don't re-add per route.
