/**
 * Client-side input scrubbing.
 *
 * Only the helpers that are actually used live here — React escapes rendered
 * values by default and the backend re-validates everything, so a large
 * unused sanitizer surface was just dead weight (it also pulled in DOMPurify
 * for a `sanitizeHTML` export nothing called).
 */

/**
 * Strip characters that could start an HTML injection out of a plain-text field.
 * @param {string} input
 * @returns {string}
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Normalise an email to the characters legal in an address.
 * @param {string} email
 * @returns {string}
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') return '';

  return email
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9@._-]/g, '');
}
