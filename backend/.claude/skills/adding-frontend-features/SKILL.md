---
name: adding-frontend-features
description: Scaffold a new frontend feature in the Naturanza Food React app located in the sibling ../frontend folder. Use when adding a page, component, context provider, or API call to the storefront/admin UI. Follows the project's React 19 + Vite 7 + Tailwind + Radix UI + React Hook Form/Zod + Context API + axios-service conventions.
---

# Adding a frontend feature

The frontend lives in **`../frontend`** (sibling of this backend folder). It is React 19 + Vite 7,
Tailwind CSS 3 + Radix UI, React Router 7, Context API for state, and a single axios service layer.

## Orient first

- Functional components + hooks only (arrow functions). No class components, no Redux.
- API calls go through **`src/services/api.js`** (axios instance with CSRF + auth-refresh interceptors),
  organized into namespaces (`productAPI`, `userAPI`, `adminAPI`, `cartAPI`, ...). Never call axios/fetch directly from components.
- Global state = a Context provider in `src/context/` exposing a `useXxx()` hook (e.g. `useCart`). Read an
  existing one (`src/context/CartContext.jsx`) before writing a new one.
- Styling = Tailwind utility classes + Radix primitives + Lucide icons. Use `clsx`/`tailwind-merge` helpers
  in `src/lib/`. No CSS-in-JS.
- Forms = React Hook Form + `@hookform/resolvers` + zod.
- Pages live in `src/pages/`, reusable pieces in `src/components/`, page sections in `src/sections/`.
- Admin routes are lazy-loaded and code-split; follow the existing routing in `App.jsx`.

## Steps

1. **Read the closest existing analog** (a similar page/component/context) and mirror its structure, imports, and naming.
2. **API layer:** add the endpoint(s) to the right namespace in `src/services/api.js`. Reuse the shared
   axios instance and error-handling shape (`error.response?.data?.error`).
3. **State (if needed):** add or extend a Context provider in `src/context/`; expose actions + a `useXxx()` hook;
   use optimistic updates where the existing contexts do. Wire the provider into `App.jsx`.
4. **UI:** build the page/component with functional components, Tailwind classes, Radix primitives, and Lucide icons.
   Use `react-loading-skeleton` for loading and `sonner` for toasts (match existing usage).
5. **Forms:** React Hook Form + zod resolver; surface field errors inline.
6. **Routing:** register the route in `App.jsx` (lazy-load admin pages); guard with `ProtectedRoute`/`AdminProtectedRoute` as appropriate.
7. **SEO (public pages):** add the SEO/structured-data components the existing pages use (`react-helmet-async`).

## Rules

- Reuse existing components/hooks/utils before creating new ones (DRY, modular).
- Keep components focused (SRP): split presentational vs. data-fetching concerns.
- Sanitize any HTML with `dompurify` (already a dependency) — never `dangerouslySetInnerHTML` raw input.
- Dev server: `npm run dev` in `../frontend` (port **5173**, proxies `/api`, `/uploads`, `/images` → `:5000`).
- Apply the dead-code rule: remove unused imports/components; the file must be cleaner after edits.
- Finish by running `/reviewing-code-quality` on the diff.
