# Deploying Naturanza Food to Hostinger (Business plan)

This app runs as **one Node.js application** on Hostinger that serves both the API and the React
frontend from a single domain: **naturanzafood.com**. No separate frontend hosting is needed.

> Architecture recap: when `NODE_ENV=production`, `backend/index.js` serves the compiled frontend
> from `frontend/dist` with SPA fallback, alongside `/api/*`, `/images`, and `/uploads`.

---

## 0. Before you start — rotate the exposed secrets ⚠️

The following live credentials were visible in plaintext during setup. **Treat them as compromised
and regenerate them before going live:**

| Secret | How to rotate |
| --- | --- |
| **JWT_SECRET** | Already done — a fresh value is in `backend/.env.example`. (Or generate your own: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.) Rotating it logs out all existing sessions, which is fine for a new deploy. |
| **Gmail App Password** (`SMTP_PASS`) | Google Account → Security → App passwords → delete the old one, create a new one. |
| **Google OAuth client secret** (`GOOGLE_CLIENT_SECRET`) | Google Cloud Console → APIs & Services → Credentials → your OAuth client → reset/replace the secret. |
| **DEFAULT_ADMIN_PASSWORD** | Choose a new strong password (≥ 12 chars). |

Use the rotated values when you fill in the Environment Variables (step 3).

---

## 1. Create the MySQL database

In **hPanel → Databases → MySQL Databases**:

1. Create a new database (note the **database name**).
2. Create a database user, set a strong password, and grant it All Privileges on that database.
3. Record: **host** (usually `localhost`), **database name**, **user**, **password**.

### Import the schema

Open **phpMyAdmin** for the new database and import `backend/schema/database.sql`.

- The server also runs `ensureProductionSchema()` on boot, which fills in compatibility columns.
- If you need later schema changes, apply the files in `backend/schema/migrations/*.sql` in order
  (lowest number first) via phpMyAdmin.

---

## 2. Create the Node.js app and connect GitHub

In **hPanel → Websites → Add Website → Node.js App** (Business plan supports this):

1. **Connect GitHub** and select your repository, branch `main`.
2. **Node version:** 22 (18 or 20 also work).
3. If Hostinger asks for these (framework type "Other"):
   - **Entry / startup file:** `backend/index.js`
   - **Build command:** `npm run build`
   - **Output / build directory:** `frontend/dist`
4. Hostinger runs `npm install` automatically. The root `postinstall` then installs the backend and
   frontend dependencies, and `npm run build` compiles the frontend into `frontend/dist`.

> **If the build fails with "vite: command not found"**, the platform pruned devDependencies before
> building. In the app's build settings ensure dev dependencies are installed for the build step
> (e.g. `npm install --include=dev` as the install command), since `vite` is a devDependency.

---

## 3. Set Environment Variables

In the Node.js app's **Environment Variables** panel, add every key from `backend/.env.example`
using your **real** values (rotated secrets from step 0, DB credentials from step 1).

Critical ones:

```
NODE_ENV=production
TRUST_PROXY=true
DB_HOST=localhost
DB_PORT=3306
DB_USER=<your db user>
DB_PASSWORD=<your db password>
DB_NAME=<your db name>
JWT_SECRET=<from backend/.env.example or your own>
CORS_ALLOWED_ORIGINS=https://naturanzafood.com,https://www.naturanzafood.com
ENABLE_RATE_LIMITS=true
ENABLE_CSRF_PROTECTION=true
ENFORCE_HTTPS=true
COOKIE_SECURE=true
GOOGLE_CLIENT_ID=<...>
GOOGLE_CLIENT_SECRET=<rotated>
SEED_DEFAULT_ADMIN=true
DEFAULT_ADMIN_EMAIL=<...>
DEFAULT_ADMIN_PASSWORD=<new strong password>
SMTP_USER=<...>
SMTP_PASS=<rotated gmail app password>
FRONTEND_URL=https://naturanzafood.com
CLIENT_URL=https://naturanzafood.com
ADMIN_URL=https://naturanzafood.com/admin/login
```

- **Do not** set `PORT` — Hostinger injects it and `backend/index.js` reads `process.env.PORT`.
- Do **not** upload a real `.env` file; the dashboard values become `process.env` directly.

---

## 4. Domain, DNS, and SSL

1. In hPanel, attach the domain **naturanzafood.com** (and `www`) to this Node.js app.
2. Point DNS to Hostinger (use Hostinger nameservers, or set the A/CNAME records they provide).
3. Enable the free **SSL certificate** for both `naturanzafood.com` and `www.naturanzafood.com`.

With `ENFORCE_HTTPS=true`, the server redirects HTTP → HTTPS automatically.

---

## 5. Update Google OAuth

In **Google Cloud Console → Credentials → OAuth 2.0 Client**:

- **Authorized JavaScript origins:** add `https://naturanzafood.com` (and `https://www.naturanzafood.com`).
- **Authorized redirect URIs:** add your live origin if your OAuth flow uses a redirect URI.

---

## 6. Deploy and verify

1. Trigger the deployment in hPanel (or push to `main` if auto-deploy is on).
2. After it goes live, verify:
   - `https://naturanzafood.com/api/health` → `{"status":"ok", ...}`
   - The storefront loads; a deep link like `https://naturanzafood.com/products` works (SPA fallback).
   - Log in to the admin panel at `https://naturanzafood.com/admin/login` with the seeded admin.
3. **Lock down the seed:** once admin login works, set `SEED_DEFAULT_ADMIN=false` in Environment
   Variables and redeploy, so the default admin isn't re-seeded on every boot.

---

## Notes

- **Uploaded media** (`backend/uploads/`) is written at runtime. Depending on the platform, this
  directory may not survive redeploys. If you rely on admin-uploaded images long-term, move them to
  persistent storage (e.g. an object store) as a follow-up.
- **Updates:** push to `main` → redeploy from hPanel (or auto-deploy). Each deploy reinstalls deps
  and rebuilds the frontend.
