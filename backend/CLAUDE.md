# Naturanza Food — Backend

Pakistan-focused food e-commerce REST API. Node.js + Express 5 + MySQL 8 (no ORM). Serves a React
frontend that lives in the sibling `../frontend` folder.

## Stack (pinned)

- **Runtime:** Node.js, CommonJS (`require` / `module.exports`, `"type": "commonjs"`).
- **Core:** express `^5.2.1`, mysql2 `^3.22.0` (promise pool), zod `^4.3.6`.
- **Auth/security:** jsonwebtoken `^9.0.3`, bcryptjs `^2.4.3`, helmet `^8.1.0`, cors, hpp, express-rate-limit, cookie-parser.
- **Files/media:** multer `^2.1.1` + sharp `^0.34.5` (WebP). Email: nodemailer `^8.0.7`. PDF: pdfkit. OAuth: google-auth-library.
- **Dev:** nodemon `^3.1.14`, kill-port.

## Run

```bash
npm run dev      # nodemon; predev kills anything on port 5000
npm start        # production (node index.js)
```

Migrations are SQL files in `schema/migrations/` applied manually (the runner scripts are
per-migration, not auto-discovering) — see the `/creating-db-migrations` skill.

- Port **5000** (env `PORT`). Health check: `GET /api/health`. API base: `/api/*`.
- Config comes from `.env` (template in `.env.example`): DB_*, JWT_SECRET, CORS_ALLOWED_ORIGINS,
  GOOGLE_*, SMTP_*, SEED_DEFAULT_ADMIN. Never hardcode or log these.

## Architecture — request lifecycle

```
HTTP → routes/ → middleware (auth, restrictBody, asyncHandler) → controllers/ → models/ → MySQL (dbPool)
                                                                      ↓ throws
                                                            middleware/errorHandler.js → { error }
```

- **routes/** wire middleware + delegate to a controller. See `routes/CLAUDE.md`.
- **controllers/** orchestrate, validate input shape, shape the HTTP response. See `controllers/CLAUDE.md`.
- **models/** own all SQL and data rules. See `models/CLAUDE.md`.
- **config/db.js** exports `dbPool`, `db`, `testDatabaseConnection()`, `withTransaction(fn)`.
- Reference implementation to copy from: `routes/categories.js` + `controllers/categoryController.js` + `models/categoryModel.js`.

## Golden rules (MUST follow)

1. **`asyncHandler` wraps every controller at the route layer** (`middleware/asyncHandler.js`). Controllers themselves contain **no try/catch**.
2. **Parameterized SQL only** — `dbPool.query(sql, [params])`. Never interpolate user input into SQL strings.
3. **Throw domain errors from models** via `createModelError(message, statusCode, code)`; let them bubble to `errorHandler`.
4. **Validate + whitelist input** — zod schemas (see `validation/authSchemas.js`) and `restrictBody(...fields)` (`middleware/security.js`) on every POST/PUT.
5. **Dead-code removal is mandatory** (`.github/copilot-instructions.md`): no commented-out blocks, no duplicate functions, code is cleaner after every edit.
6. **Never log secrets or tokens.** Keep controllers thin; put logic in models/utils (SRP, modular).

## Domain notes

- Payments: `cod`, `card`, `online`, `easypaisa`, `jazzcash`. Currency **PKR**, default tax 18%, per-city delivery fees.
- Roles: customer / admin, with `admin_role` (super_admin, staff_admin) + JSON `admin_permissions`. Admin-only routes use `isAdmin`; super-admin use `requireSuperAdmin`.
- Stock has `stock_quantity` + `reserved_stock` (COD holds); a reservation sweeper runs on an interval.

## Skills (invoke with `/<name>`)

- `/adding-api-features` — scaffold a new endpoint across routes + controller + model.
- `/creating-db-migrations` — author + run a numbered migration.
- `/reviewing-code-quality` — pre-finish design-principles + dead-code checklist.
- `/adding-frontend-features` — scaffold a feature in `../frontend` (React 19 + Vite + Tailwind + Radix).
