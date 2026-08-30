import type { Metadata } from "next";

import { StorefrontShell } from "@/components/layout/StorefrontShell";
import { NotFoundCard } from "@/components/not-found/NotFoundCard";

/**
 * The global 404, for any URL that matches no route.
 *
 * WHY IT IS NOT UNDER (storefront). Next only reaches a `not-found` file inside
 * a route group when `notFound()` is called from within that group — an unmatched
 * URL never enters a group in the first place, so the file that answers it has to
 * be here, at the app root, wrapped by `src/app/layout.tsx` alone. It therefore
 * cannot inherit the storefront layout, and renders `StorefrontShell` directly
 * so that a 404 still gets the navigation, announcement bar and footer, exactly
 * as the SPA's `<Route path="*">` did.
 *
 * STATUS AND INDEXING. Next answers an unmatched URL with a real HTTP 404 and
 * this body, so a retired URL is no longer served as a cacheable 200 the way the
 * SPA's catch-all was — every unknown path used to return the index document
 * with a success status, which is how a mistyped URL gets indexed. The `robots`
 * block below is the port of `NoIndexSEO`, and it matters independently of the
 * status code: `notFound()` inside the storefront renders this same component,
 * and a crawler that has already fetched the URL should be told twice.
 *
 * No canonical is emitted. The SPA pointed one at `window.location.href`, which
 * declares a 404 to be the authoritative version of itself.
 */

/**
 * Not prerendered: `StorefrontShell` mounts client components, and their inline
 * hydration scripts are admitted by a per-request CSP nonce (backend/csp.js).
 * Build-time HTML would carry a nonce matching no later response.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function NotFound() {
  return (
    <StorefrontShell>
      <NotFoundCard />
    </StorefrontShell>
  );
}
