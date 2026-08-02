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
