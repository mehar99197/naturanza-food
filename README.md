# Naturanza Food

A full-stack, Pakistan-focused organic food e-commerce application. A single Node.js/Express server
exposes a REST API **and** serves the compiled React storefront + admin panel, so the whole app runs
on one domain.

## Stack

- **Frontend:** React 19, Vite 7, Tailwind CSS 3, Radix UI, React Router 7, React Hook Form + Zod, axios.
- **Backend:** Node.js + Express 5 (CommonJS), MySQL 8 via `mysql2` (no ORM), Zod validation.
- **Auth/security:** JWT, bcrypt, Helmet, CORS, HPP, rate limiting, CSRF, Google OAuth.
- **Media/email:** Multer + Sharp (WebP), Nodemailer (Gmail SMTP), PDFKit (invoices).

## Project layout

```
.
├── backend/        Express API + serves the built frontend in production (entry: index.js)
│   ├── routes/ controllers/ models/   layered request lifecycle
│   ├── config/db.js                   MySQL pool
│   ├── schema/database.sql            full schema + schema/migrations/*.sql
│   └── .env.example                   production env reference (placeholders)
├── frontend/       React + Vite app (builds to frontend/dist)
│   └── .env.production                committed public build-time config
├── package.json    root scripts: install both, build frontend, start server
├── DEPLOYMENT.md   step-by-step Hostinger deployment runbook
└── README.md
```

## Local development

Requires Node.js 18+ and a local MySQL/MariaDB.

```bash
# 1. Install all dependencies (root, backend, and frontend)
npm install

# 2. Configure the backend
cp backend/.env.example backend/.env
#    then edit backend/.env with local DB credentials and NODE_ENV=development

# 3. Create the database and import the schema
#    mysql -u root -p -e "CREATE DATABASE naturanza_food"
#    mysql -u root -p naturanza_food < backend/schema/database.sql

# 4. Run backend (:5000) + frontend (:5173) together with hot reload
npm run dev
```

The Vite dev server proxies `/api`, `/uploads`, and `/images` to the backend on port 5000.

## Production build (single server)

```bash
npm run build        # builds the frontend into frontend/dist
NODE_ENV=production node backend/index.js
```

In production the Express server serves `frontend/dist` with SPA fallback, so the storefront, admin
panel, and API are all available on the same origin (e.g. `https://naturanzafood.com`).

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full Hostinger (Business plan) runbook, including
database setup, environment variables, GitHub deployment, DNS/SSL, and the post-deploy checklist.

## Health check

`GET /api/health` → `{ "status": "ok", "timestamp": "..." }`
