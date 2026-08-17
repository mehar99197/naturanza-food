/**
 * Link and image destinations: reading them out of the source, and deciding
 * which are safe to emit.
 */

/**
 * The only schemes a link may carry.
 *
 * `safeHref` returns "" for anything else — `javascript:` above all — which the
 * renderer turns into "#", matching the original's `href || '#'` fallback. Post
 * bodies are admin-authored, but they are still stored data, and a stored
 * `javascript:` href is a one-click XSS on every reader of that article.
 */
const SAFE_ABSOLUTE = /^(?:https?:|mailto:|tel:)/i;

export const safeHref = (raw: string): string => {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("?")) return value;
  if (value.startsWith("./") || value.startsWith("../")) return value;
  if (SAFE_ABSOLUTE.test(value)) return value;
  return "";
};

export interface LinkParts {
  label: string;
  href: string;
  /** Index just past the closing parenthesis. */
  end: number;
}

/**
 * Reads `[label](destination)` starting at the opening bracket.
 *
 * Brackets and parentheses are matched by depth rather than by searching for the
 * next one, so a label containing brackets — or a URL containing parentheses,
 * which Wikipedia links routinely do — does not end the construct early.
 */
export const readLink = (source: string, start: number): LinkParts | null => {
  let depth = 0;
  let index = start;

  for (; index < source.length; index += 1) {
    const char = source[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth === 0) break;
    }
  }

  if (depth !== 0 || source[index] !== "]") return null;

  const labelEnd = index;
  if (source[labelEnd + 1] !== "(") return null;

  let parens = 0;
  let cursor = labelEnd + 1;

  for (; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    if (char === "\\") {
      cursor += 1;
      continue;
    }
    if (char === "(") parens += 1;
    else if (char === ")") {
      parens -= 1;
      if (parens === 0) break;
    }
  }

  if (parens !== 0 || source[cursor] !== ")") return null;

  const destination = source.slice(labelEnd + 2, cursor).trim();
  // A title after the URL is parsed off but not kept: the original's renderers
  // took only `href` and `children`, so a title never reached the DOM.
  const withoutTitle = destination.replace(/\s+(?:"[^"]*"|'[^']*'|\([^)]*\))$/, "");

  return {
    label: source.slice(start + 1, labelEnd),
    href: withoutTitle.replace(/^<|>$/g, ""),
    end: cursor + 1,
  };
};
