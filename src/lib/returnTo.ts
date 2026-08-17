/**
 * Where to send a visitor back to after they sign in.
 *
 * React Router carried this in `location.state`, which the App Router has no
 * equivalent for. A `?returnTo=` parameter replaces it and is strictly better in
 * one respect — router state was lost on refresh, a query parameter is not.
 *
 * The validation below is the point of this module. A return path that arrives
 * in the URL is attacker-controlled, so anything that is not a plain same-site
 * path is discarded rather than sanitised: `//evil.com` and
 * `https://evil.com` are both browser-valid redirect targets that would take a
 * customer off the site mid-login, and `\\evil.com` is the same trick with the
 * separator some parsers normalise late.
 */

export const RETURN_TO_PARAM = "returnTo";

/**
 * True only for a path that stays on this site: begins with a single "/", and
 * carries no scheme, host, or backslash.
 */
export const isSafeReturnPath = (value: string | null | undefined): boolean => {
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  // "//host" and "/\host" are protocol-relative URLs, not local paths.
  if (value.startsWith("//") || value.startsWith("/\\")) return false;
  if (value.includes("\\")) return false;
  return true;
};

/** Builds a sign-in URL that remembers where the visitor was. */
export const loginUrlFor = (returnPath: string | null | undefined): string =>
  isSafeReturnPath(returnPath)
    ? `/login?${RETURN_TO_PARAM}=${encodeURIComponent(returnPath as string)}`
    : "/login";

/** Reads a validated return path, falling back to the home page. */
export const readReturnPath = (raw: string | null | undefined): string =>
  isSafeReturnPath(raw) ? (raw as string) : "/";
