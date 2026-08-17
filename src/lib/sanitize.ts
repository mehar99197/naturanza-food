/**
 * Input sanitisation helpers, ported from frontend/src/lib/sanitize.js.
 *
 * ⚠ `sanitizeHTML` — the one function here that actually made untrusted HTML
 * safe to render — is NOT in this file. It wraps DOMPurify, and `dompurify` is
 * a dependency of the Vite app only; it is not installed at the Next root and
 * this port is not allowed to add it. Nothing below is a substitute:
 * `sanitizeText` and `sanitizeInput` are regex string scrubbers, and a regex
 * cannot parse HTML. Do NOT reach for them to clean markup destined for
 * dangerouslySetInnerHTML. Add `dompurify` to the root package.json and port
 * `sanitizeHTML` before migrating any component that renders rich text.
 *
 * The rest are defence in depth, not a boundary: the real guarantees are the
 * backend's validation and React's own escaping of interpolated text.
 */

/**
 * Strips the characters most often used to smuggle markup into a value.
 *
 * Non-strings pass through untouched — the original is called with whole form
 * values of mixed type and leaves numbers and booleans alone.
 */
export function sanitizeInput<T>(input: T): T | string {
  if (typeof input !== "string") return input;

  // Remove < and > to prevent HTML injection
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
}

/**
 * Removes anything that looks like a tag, for text destined to be shown as
 * plain text. Non-strings pass through untouched.
 */
export function sanitizeText<T>(text: T): T | string {
  if (typeof text !== "string") return text;

  // Remove all HTML tags
  return text.replace(/<[^>]*>/g, "").trim();
}

/**
 * Lowercases an email and drops every character an address cannot contain.
 *
 * This silently *rewrites* rather than rejects: "A B@x.com" becomes "ab@x.com".
 * Validate before sanitising if the user should see an error instead.
 */
export function sanitizeEmail(email: unknown): string {
  if (typeof email !== "string") return "";

  return email
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9+@._-]/g, "");
}

/**
 * Returns the URL unchanged if it is absolute http(s), otherwise "".
 *
 * Note this rejects *relative* URLs too — `new URL("/images/a.png")` throws
 * without a base — so it suits link hrefs from user input, not internal paths.
 */
export function sanitizeURL(url: unknown): string {
  if (typeof url !== "string") return "";

  // Only allow http and https protocols
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return url;
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * Runs `sanitizeInput` over every string in an object, recursing into nested
 * objects.
 *
 * ⚠ Arrays are objects to `typeof`, so an array value recurses and comes back
 * as a plain object keyed "0", "1", … — likewise a Date or File becomes {}.
 * Preserved from the original; pass only flat/nested plain-object form data.
 */
export function sanitizeFormData(
  formData: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const key in formData) {
    if (Object.prototype.hasOwnProperty.call(formData, key)) {
      const value = formData[key];

      if (typeof value === "string") {
        sanitized[key] = sanitizeInput(value);
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizeFormData(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
};

/**
 * Escapes the characters that terminate HTML text and attribute contexts.
 *
 * React already does this for interpolated text; this is for the places that
 * bypass it. Non-strings pass through untouched.
 */
export function escapeHTML<T>(str: T): T | string {
  if (typeof str !== "string") return str;

  // The `?? char` arm is unreachable — the character class and the map hold the
  // same six characters — and exists only to satisfy noUncheckedIndexedAccess.
  return str.replace(/[&<>"'/]/g, (char) => HTML_ESCAPES[char] ?? char);
}

const xssPatterns = [
  /<script/i,
  /javascript:/i,
  /on\w+=/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /eval\(/i,
];

/**
 * Heuristic "does this look like an injection attempt" check.
 *
 * A detector, not a filter: it both misses obfuscated payloads and fires on
 * innocent prose (any "…on=" reads as an event handler). Use it for logging or
 * a soft warning — never as the thing that decides something is safe to render.
 */
export function containsXSS(str: unknown): boolean {
  if (typeof str !== "string") return false;

  return xssPatterns.some((pattern) => pattern.test(str));
}
