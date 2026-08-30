import type { Metadata } from "next";

import { AboutCertifications } from "@/components/about/AboutCertifications";
import { AboutHero } from "@/components/about/AboutHero";
import { AboutStats } from "@/components/about/AboutStats";
import { AboutStory } from "@/components/about/AboutStory";
import { AboutTeam } from "@/components/about/AboutTeam";
import { AboutValues } from "@/components/about/AboutValues";
import type { AboutContent } from "@/components/about/types";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { DEFAULT_OG_IMAGE, LOCALE, SITE_NAME, SITE_URL } from "@/config/site";
import { DEFAULT_ABOUT_CONTENT, getAboutContent } from "@/server/about/content";
import { listActiveTeamMembers } from "@/server/about/team";
import { buildBreadcrumbJsonLd } from "@/server/seo/jsonLd";

/**
 * /about — a Server Component.
 *
 * The SPA version rendered an empty shell and then fetched both the copy and the
 * team roster from the browser, so the whole page was invisible to a crawler
 * that does not execute JavaScript. Here both reads happen on the server and the
 * text ships in the initial HTML; the sections stay Client Components only
 * because of their scroll-reveal and counter animations, and they receive the
 * data as props.
 *
 * `force-dynamic` keeps an admin's edit live on the next request. It also keeps
 * `next build` from needing a database — the content is admin-editable, so
 * baking it in at build time would be wrong on both counts. Swap it for
 * `revalidate` if the page ever warrants a cache.
 */
export const dynamic = "force-dynamic";

const TITLE = "About Us";
const DESCRIPTION =
  "Discover Naturanza Food's story. Since 2010, we've been Pakistan's trusted source for " +
  "organic honey, herbal teas, and natural wellness products. Learn about our quality " +
  "standards, sourcing practices, and commitment to purity.";
const CANONICAL_PATH = "/about";

export function generateMetadata(): Metadata {
  const fullTitle = `${TITLE} | ${SITE_NAME}`;

  return {
    title: TITLE,
    description: DESCRIPTION,
    keywords: [
      "about Naturanza Food",
      "organic food brand Pakistan",
      "natural products company",
      "wellness brand Pakistan",
      "organic store history",
    ],
    alternates: { canonical: CANONICAL_PATH },
    // openGraph and twitter replace the parent objects wholesale rather than
    // merging field by field, so every field the social card needs is repeated
    // here — including the image, which would otherwise be dropped.
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: LOCALE,
      url: `${SITE_URL}${CANONICAL_PATH}`,
      title: fullTitle,
      description: DESCRIPTION,
      images: [{ url: DEFAULT_OG_IMAGE, alt: fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: DESCRIPTION,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

/**
 * Sanitising drops entries an admin blanked out, which can empty a list
 * entirely. The SPA fell back to the defaults in that case rather than render a
 * bare section; this applies the same rule once, so no section component has to
 * know about it.
 */
const withNonEmptyLists = (content: AboutContent): AboutContent => ({
  ...content,
  stats: content.stats.length ? content.stats : DEFAULT_ABOUT_CONTENT.stats,
  values: {
    ...content.values,
    items: content.values.items.length
      ? content.values.items
      : DEFAULT_ABOUT_CONTENT.values.items,
  },
  certifications: {
    ...content.certifications,
    items: content.certifications.items.length
      ? content.certifications.items
      : DEFAULT_ABOUT_CONTENT.certifications.items,
  },
});

export default async function AboutPage() {
  const [stored, teamMembers] = await Promise.all([
    getAboutContent(),
    listActiveTeamMembers(),
  ]);

  const content = withNonEmptyLists(stored);

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: TITLE, path: CANONICAL_PATH },
  ]);

  const { sections } = content;

  return (
    <>
      <JsonLdScript data={breadcrumbJsonLd} />
      <div className="pt-14 sm:pt-[68px] pb-0 overflow-x-hidden">
        {/* Hero */}
        <AboutHero hero={content.hero} />

        {/* Story */}
        {sections.story && <AboutStory story={content.story} />}

        {/* Stats */}
        {sections.stats && <AboutStats stats={content.stats} />}

        {/* Values */}
        {sections.values && <AboutValues values={content.values} />}

        {/* Team */}
        {sections.team && <AboutTeam team={content.team} members={teamMembers} />}

        {/* Certifications */}
        {sections.certifications && (
          <AboutCertifications certifications={content.certifications} />
        )}
      </div>
    </>
  );
}
