import "server-only";

import {
  ABOUT_VALUE_ICONS,
  type AboutContent,
  type AboutValueIconName,
} from "@/components/about/types";
import { queryOne } from "@/server/db/query";

/**
 * The About page's content, read straight from MySQL for Server Components.
 *
 * This is the read half of `backend/utils/aboutContent.js`, ported rather than
 * proxied: the SPA fetched `GET /api/about` from the browser, which meant the
 * page's entire copy arrived after hydration and was invisible to a crawler
 * that does not run JavaScript. Rendering on the server removes the round trip
 * and puts the text in the initial HTML.
 *
 * The write half stays in Express — the admin editor still PUTs to
 * `/api/admin/about`, and that endpoint owns the merge. Only the sanitiser is
 * duplicated here, deliberately: a JSON blob edited by an admin is untrusted
 * input to *this* renderer regardless of which process wrote it, and defaults
 * have to be filled in somewhere for a partial or hand-edited document to
 * render at all. The rules below are a line-for-line port, including every
 * `.slice()` cap.
 */

export const DEFAULT_ABOUT_CONTENT: AboutContent = {
  hero: {
    eyebrow: "About Naturanza",
    titleTop: "Our Journey Towards",
    titleHighlight: "Natural Wellness",
    subtitle:
      "Since 2010, we have been on a mission to bring the healing power of nature to every home, one organic product at a time.",
  },
  story: {
    heading: "From Farm to Family",
    image: "/images/about-herbs.jpg",
    paragraphs: [
      "Naturanza Food was born from a simple belief: that nature provides everything we need to live healthy, vibrant lives. Our founder, after experiencing the transformative power of herbal remedies firsthand, set out to create a brand that would make these natural solutions accessible to everyone.",
      "We started small, working directly with local organic farmers who shared our passion for purity and sustainability. Today, we have grown into a trusted name in natural wellness, but our core values remain unchanged.",
      "Every product in our collection is a testament to our commitment to quality. From the moment a seed is planted to the final product reaching your doorstep, we ensure that every step meets our rigorous standards.",
    ],
  },
  stats: [
    { value: 14, suffix: "+", label: "Years Experience" },
    { value: 50, suffix: "K+", label: "Happy Customers" },
    { value: 100, suffix: "+", label: "Organic Products" },
    { value: 25, suffix: "+", label: "Partner Farms" },
  ],
  values: {
    eyebrow: "Our Values",
    heading: "What We Stand For",
    items: [
      {
        icon: "Leaf",
        title: "Purity First",
        description:
          "We never compromise on the purity of our products. Every item is tested for quality and authenticity.",
      },
      {
        icon: "Heart",
        title: "Customer Care",
        description:
          "Your health and satisfaction are our top priorities. We are here to support your wellness journey.",
      },
      {
        icon: "Globe",
        title: "Sustainability",
        description:
          "We are committed to eco-friendly practices, from sourcing to packaging, to protect our planet.",
      },
      {
        icon: "Shield",
        title: "Transparency",
        description:
          "Full disclosure of ingredients and sourcing. Know exactly what you are putting in your body.",
      },
    ],
  },
  team: {
    eyebrow: "Our Team",
    heading: "Meet the People Behind Naturanza",
  },
  certifications: {
    heading: "Our Certifications",
    subtitle: "Trusted and certified for your peace of mind",
    items: ["USDA Organic", "Non-GMO Project", "Fair Trade", "GMP Certified"],
  },
  sections: {
    story: true,
    stats: true,
    values: true,
    team: true,
    certifications: true,
  },
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown, fallback = ""): string =>
  value === undefined || value === null ? fallback : String(value);

const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value: unknown, fallback = true): boolean =>
  typeof value === "boolean" ? value : fallback;

/** Narrows an arbitrary array-ish field, falling back to the default list. */
const arrayOr = <T>(value: unknown, fallback: T[]): unknown[] =>
  Array.isArray(value) ? value : fallback;

const nested = (source: Record<string, unknown>, key: string): Record<string, unknown> =>
  isPlainObject(source[key]) ? (source[key] as Record<string, unknown>) : {};

const toIconName = (value: unknown): AboutValueIconName => {
  const name = str(value);
  return (ABOUT_VALUE_ICONS as readonly string[]).includes(name)
    ? (name as AboutValueIconName)
    : "Leaf";
};

/**
 * Coerces a stored document to the schema, substituting the default for
 * anything missing or malformed and capping every array and string length.
 */
export const sanitizeAboutContent = (
  input: unknown,
  base: AboutContent = DEFAULT_ABOUT_CONTENT,
): AboutContent => {
  const src: Record<string, unknown> = isPlainObject(input) ? input : {};

  const hero = nested(src, "hero");
  const story = nested(src, "story");
  const values = nested(src, "values");
  const team = nested(src, "team");
  const certifications = nested(src, "certifications");
  const sections = nested(src, "sections");

  return {
    hero: {
      eyebrow: str(hero.eyebrow, base.hero.eyebrow).slice(0, 80),
      titleTop: str(hero.titleTop, base.hero.titleTop).slice(0, 160),
      titleHighlight: str(hero.titleHighlight, base.hero.titleHighlight).slice(0, 160),
      subtitle: str(hero.subtitle, base.hero.subtitle).slice(0, 600),
    },
    story: {
      heading: str(story.heading, base.story.heading).slice(0, 160),
      image: str(story.image, base.story.image).slice(0, 500),
      paragraphs: arrayOr(story.paragraphs, base.story.paragraphs)
        .slice(0, 8)
        .map((paragraph) => str(paragraph).slice(0, 1500))
        .filter((paragraph) => paragraph.trim().length > 0),
    },
    stats: arrayOr(src.stats, base.stats)
      .slice(0, 8)
      .map((entry) => {
        const stat = isPlainObject(entry) ? entry : {};
        return {
          value: num(stat.value, 0),
          suffix: str(stat.suffix, "").slice(0, 6),
          label: str(stat.label, "").slice(0, 60),
        };
      })
      .filter((stat) => stat.label.trim().length > 0),
    values: {
      eyebrow: str(values.eyebrow, base.values.eyebrow).slice(0, 80),
      heading: str(values.heading, base.values.heading).slice(0, 160),
      items: arrayOr(values.items, base.values.items)
        .slice(0, 8)
        .map((entry) => {
          const item = isPlainObject(entry) ? entry : {};
          return {
            icon: toIconName(item.icon),
            title: str(item.title, "").slice(0, 80),
            description: str(item.description, "").slice(0, 500),
          };
        })
        .filter((item) => item.title.trim().length > 0),
    },
    team: {
      eyebrow: str(team.eyebrow, base.team.eyebrow).slice(0, 80),
      heading: str(team.heading, base.team.heading).slice(0, 160),
    },
    certifications: {
      heading: str(certifications.heading, base.certifications.heading).slice(0, 160),
      subtitle: str(certifications.subtitle, base.certifications.subtitle).slice(0, 300),
      items: arrayOr(certifications.items, base.certifications.items)
        .slice(0, 12)
        .map((certification) => str(certification).slice(0, 60))
        .filter((certification) => certification.trim().length > 0),
    },
    sections: {
      story: bool(sections.story, base.sections.story),
      stats: bool(sections.stats, base.sections.stats),
      values: bool(sections.values, base.sections.values),
      team: bool(sections.team, base.sections.team),
      certifications: bool(sections.certifications, base.sections.certifications),
    },
  };
};

/**
 * Reads the single content row.
 *
 * A missing row or unparseable JSON both fall back to the defaults, exactly as
 * `GET /api/about` does — the page must render even on a fresh install where
 * nobody has opened the admin editor yet.
 */
export const getAboutContent = async (): Promise<AboutContent> => {
  const row = await queryOne<{ content: string }>(
    "SELECT content FROM about_content WHERE id = 1 LIMIT 1",
  );

  if (!row) {
    return DEFAULT_ABOUT_CONTENT;
  }

  try {
    return sanitizeAboutContent(JSON.parse(row.content));
  } catch {
    return DEFAULT_ABOUT_CONTENT;
  }
};
