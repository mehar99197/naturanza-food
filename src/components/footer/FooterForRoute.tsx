"use client";

import { usePathname } from "next/navigation";

import { Footer } from "./Footer";

/**
 * Picks the footer variant, and decides whether there is a footer at all, from
 * the current path — reproducing the rules AppContent applies in
 * frontend/src/App.jsx.
 *
 * This lives in its own client component rather than in the layout so the
 * storefront layout can stay a Server Component: only the few bytes needed to
 * read the pathname ship to the browser, not the page around it.
 *
 * Route groups express most of the SPA's chrome branching structurally — the
 * auth pages simply sit outside this layout. What cannot be expressed that way
 * is a variant that changes per route *inside* one group, which is what this
 * handles.
 */

/** Paths that render no footer at all. Matches App.jsx's noFooterRoutes. */
const NO_FOOTER_EXACT = new Set(["/orders", "/checkout"]);

/** Prefixes that render no footer. App.jsx hides it for the whole profile area. */
const NO_FOOTER_PREFIXES = ["/profile"];

export function FooterForRoute() {
  const pathname = usePathname() ?? "/";

  if (NO_FOOTER_EXACT.has(pathname)) return null;
  if (NO_FOOTER_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  // Full footer on the home page only; every other route gets the slim one.
  return <Footer variant={pathname === "/" ? "full" : "slim"} />;
}

export default FooterForRoute;
