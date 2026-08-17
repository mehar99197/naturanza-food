import { AnnouncementBar } from "@/components/AnnouncementBar";
import { FooterForRoute } from "@/components/footer/FooterForRoute";
import { Navigation } from "@/components/navigation/Navigation";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { AppProviders } from "@/providers/AppProviders";
import { buildOrganizationJsonLd } from "@/server/seo/organization";

/**
 * The public storefront shell.
 *
 * It reproduces the tree AppContent builds in frontend/src/App.jsx for a public
 * route — the same wrapper element, the same skip link, the same chrome in the
 * same order — so a page renders identically whether it is served from here or
 * from the Vite build during the migration.
 *
 * The SPA decided chrome at runtime from the pathname (`showPublicChrome`,
 * `isAuthFocusRoute`, `isAdminRoute`). Route groups express that structurally
 * instead: pages that want this chrome live under (storefront), and the auth and
 * admin areas get their own group with their own shell rather than branching
 * here. Only the footer still varies within this group, which FooterForRoute
 * handles.
 *
 * This file is a Server Component. AppProviders is the client boundary, and
 * because `children` is passed through it as an already-rendered tree, the pages
 * inside stay server-rendered.
 */
/**
 * Every storefront route renders per request. This is set here, on the layout,
 * because route segment config cascades to everything nested below it — one
 * decision in one place rather than a directive on each page that a later
 * addition can silently forget.
 *
 * The reason is the Content-Security-Policy (see backend/csp.js). The policy
 * does not allow 'unsafe-inline' in script-src, so Next's inline hydration
 * scripts are admitted by a per-request nonce instead. HTML generated once at
 * build time would carry a nonce that matches no later response, and the
 * browser would block the very scripts that make the page work.
 *
 * The cost is static generation and ISR, which this app was never going to get
 * much from: prices, stock, cart state and announcements are per request
 * anyway. The win that matters — real content in the first response instead of
 * an empty shell — is unaffected.
 */
export const dynamic = "force-dynamic";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      {/* Who the business is, once per document. Pages add only the schema that
          is specific to them — a product, a post, their breadcrumb trail. */}
      <JsonLdScript data={buildOrganizationJsonLd()} />

      <div className="min-h-screen flex flex-col site-glass-shell">
        {/* Skip to main content link for keyboard accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-green-600 focus:text-white focus:rounded-lg focus:font-semibold focus:text-sm"
        >
          Skip to main content
        </a>

        <AnnouncementBar />
        <Navigation />

        <main id="main-content" className="w-full flex-1">
          {children}
        </main>

        <FooterForRoute />
      </div>
    </AppProviders>
  );
}
