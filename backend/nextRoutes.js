/**
 * Which URLs the Next.js app owns.
 *
 * The migration runs route by route: a path listed here is rendered by Next, and
 * everything else still falls through to the Vite SPA and its SEO meta renderer.
 * Next cannot make that decision itself — its request handler answers unknown
 * paths with its own 404 instead of passing them on — so the split lives here,
 * as an explicit, reviewable list.
 *
 * Adding a page to the migration means adding its pattern here in the same
 * commit. Removing a pattern reverts that page to the SPA with no other change,
 * which is what makes a phase individually revertible.
 */

/** Assets and internals Next must always serve, whatever else has migrated. */
const NEXT_INTERNAL_PATTERNS = [
  /^\/_next\//,
  /^\/__nextjs/, // dev-only error overlay endpoints
];

/**
 * Pages migrated so far, most specific first.
 *
 * Phase 1 deliberately claims only a route that does not exist today, so the
 * proving deploy cannot regress a page a customer can reach.
 */
const MIGRATED_PAGE_PATTERNS = [
  /^\/render-check\/?$/,
];

const ALL_PATTERNS = [...NEXT_INTERNAL_PATTERNS, ...MIGRATED_PAGE_PATTERNS];

/**
 * True when Next.js should answer this request.
 *
 * Takes the path only — never the query string — so a crafted `?` cannot make a
 * pattern match something it was not written for.
 */
const isNextRoute = (pathname) => {
  const path = String(pathname || "").split("?")[0];
  return ALL_PATTERNS.some((pattern) => pattern.test(path));
};

module.exports = {
  isNextRoute,
  NEXT_INTERNAL_PATTERNS,
  MIGRATED_PAGE_PATTERNS,
};
