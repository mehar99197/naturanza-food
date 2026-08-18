import { AnnouncementBar } from "@/components/AnnouncementBar";
import { FooterForRoute } from "@/components/footer/FooterForRoute";
import { Navigation } from "@/components/navigation/Navigation";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { AppProviders } from "@/providers/AppProviders";
import { buildOrganizationJsonLd } from "@/server/seo/organization";

/**
 * The public site chrome: providers, organization schema, and the announcement
 * bar / navigation / footer that wrap every public page.
 *
 * It is a component rather than markup inside the storefront layout because two
 * different files need the identical shell. The storefront layout is one. The
 * other is the global 404 at `src/app/not-found.tsx`, which Next renders for an
 * unmatched URL — and an unmatched URL never enters a route group, so it is
 * wrapped by the ROOT layout and cannot inherit the storefront one. Without a
 * shared shell the 404 would render bare, where the SPA's `<Route path="*">`
 * got the full chrome; with the shell duplicated instead of extracted, the two
 * copies would drift.
 *
 * This is a Server Component. AppProviders is the client boundary, and because
 * `children` is passed through it as an already-rendered tree, pages inside stay
 * server-rendered.
 */
export function StorefrontShell({ children }: { children: React.ReactNode }) {
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
