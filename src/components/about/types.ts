/**
 * The shape of the About page's content document.
 *
 * `about_content` stores one JSON blob (id = 1) that an admin edits, so these
 * types are the contract between `backend/utils/aboutContent.js`, the server
 * loader in `@/server/about/content` and the section components below.
 *
 * They live under `components/` rather than `server/` on purpose: the section
 * components are Client Components, and a client module that imports from a
 * `server-only` file is a boundary violation waiting to happen even when the
 * import is type-only. The server loader imports *down* into this file instead,
 * matching the `components/footer/types.ts` convention already in the tree.
 */

/**
 * Icon names a value card may use.
 *
 * Mirrors `ALLOWED_VALUE_ICONS` in `backend/utils/aboutContent.js`. The
 * whitelist is what keeps the client bundle from having to carry every lucide
 * icon just because the column is free text.
 */
export const ABOUT_VALUE_ICONS = [
  "Leaf",
  "Heart",
  "Globe",
  "Shield",
  "Award",
  "Sparkles",
  "Sprout",
  "Sun",
  "Droplet",
  "Recycle",
  "HandHeart",
  "BadgeCheck",
] as const;

export type AboutValueIconName = (typeof ABOUT_VALUE_ICONS)[number];

export interface AboutHeroContent {
  eyebrow: string;
  titleTop: string;
  titleHighlight: string;
  subtitle: string;
}

export interface AboutStoryContent {
  heading: string;
  image: string;
  paragraphs: string[];
}

export interface AboutStat {
  value: number;
  suffix: string;
  label: string;
}

export interface AboutValueItem {
  icon: AboutValueIconName;
  title: string;
  description: string;
}

export interface AboutValuesContent {
  eyebrow: string;
  heading: string;
  items: AboutValueItem[];
}

export interface AboutTeamContent {
  eyebrow: string;
  heading: string;
}

export interface AboutCertificationsContent {
  heading: string;
  subtitle: string;
  items: string[];
}

/** Per-section visibility switches an admin toggles. */
export interface AboutSectionToggles {
  story: boolean;
  stats: boolean;
  values: boolean;
  team: boolean;
  certifications: boolean;
}

export interface AboutContent {
  hero: AboutHeroContent;
  story: AboutStoryContent;
  stats: AboutStat[];
  values: AboutValuesContent;
  team: AboutTeamContent;
  certifications: AboutCertificationsContent;
  sections: AboutSectionToggles;
}

/**
 * A row of `team_members` as the public list exposes it — the same five columns
 * `GET /api/team` selects.
 */
export interface TeamMember {
  id: number;
  name: string;
  role: string;
  image: string | null;
  bio: string | null;
}
