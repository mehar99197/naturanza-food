# Security notes

## Accepted dependency advisory

### `react-router` / `react-router-dom` — GHSA-qwww-vcr4-c8h2 (high)

> React Router: RSC Mode CSRF Bypass Allows Action Execution Before 400 Response
> Affected range: `>=7.12.0 <=8.2.0`

**Status: not applicable to this app — deliberately not "fixed".**

`npm audit fix --force` resolves this by downgrading `react-router-dom` to **7.11.0**,
seven minor versions behind the installed **7.18.2**. That trade is not worth taking here:

- The advisory only affects **RSC (React Server Components) mode**. This app does not use it:
  - `frontend/src/App.jsx` renders `BrowserRouter` — the plain client router.
  - There is no `createBrowserRouter` / `RouterProvider` data router, no `@react-router/dev`,
    no `routes.ts`, and no import from `react-router/rsc`.
  - `frontend/components.json` records `"rsc": false`.
- There is no patched release in the 7.x line yet, and no 8.x has been published.

**Re-evaluate this note when:**
- a fixed `react-router-dom` release ships (then upgrade and delete this section), or
- the app ever adopts RSC mode / a framework-mode data router — at which point the
  advisory becomes live and the upgrade is mandatory before shipping.

Verify the assumption still holds with:

```bash
cd frontend
grep -rn "createBrowserRouter\|RouterProvider\|react-router/rsc\|@react-router/dev" src/
npm audit
```

## Backend

`npm audit --omit=dev` in `backend/` reports **0 vulnerabilities**.

## Hostinger vulnerability scanner — frontend build-tooling advisories

The hPanel scanner (Security → Vulnerabilities) has flagged, on the **deployed** server:
`postcss`, `esbuild`, `js-yaml`, and `brace-expansion` (e.g. CVE-2026-14257,
GHSA-r28c-9q8g-f849, CVE-2026-59869, and the withdrawn esbuild GHSA-gv7w-rqvm-qjhr).

**Status: not runtime-exploitable.** Every one of these is a **dev/build-only** dependency —
`postcss`/`esbuild` via Vite, `js-yaml` via eslint, `brace-expansion` via
`eslint-plugin-react → minimatch`. `npm ls --omit=dev` shows **none** of them in the production
dependency tree. The live app runs `node backend/index.js` (backend `npm audit` = 0) and serves the
pre-built static `frontend/dist`; it never loads any of these packages at runtime.

Why the scanner still sees them: the deploy installs devDependencies to run `vite build`, and the
tooling was previously left in `frontend/node_modules` on the server afterwards. The repo lockfile
already pins patched `postcss` 8.5.25 / `esbuild` 0.28.1 / `js-yaml` 4.3.1; a stale scan predates
that deploy. `brace-expansion`'s "fixed" line (5.x) would require a cross-major override of an
eslint transitive — avoided, because it is not shipped at runtime.

**Fix applied:** the root `postinstall` now deletes `frontend/node_modules` **after** the build
(`… && npm --prefix frontend run build && rm -rf frontend/node_modules`), so the deployed server
carries only `frontend/dist` + `backend/node_modules` — the build/lint tooling the scanner flags is
gone. ⚠️ This assumes the frontend is built **only** by `postinstall` (the documented flow). If a
**separate Build Command** is configured in the hPanel Node app (`npm run build`) to run *after*
install, remove it — otherwise it would run after the prune and fail with `vite: not found`.
Re-run the scan after the next deploy to confirm the advisories clear.
