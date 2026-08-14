/**
 * HTML escaping for values interpolated into outbound HTML — transactional
 * email bodies and the few server-rendered pages (newsletter unsubscribe).
 *
 * The storefront is React and escapes its own output, so this is not about the
 * SPA. It exists because email templates build raw HTML strings from order and
 * account fields that a customer typed, and nothing between the request and the
 * recipient's inbox escapes them.
 *
 * Uses `?? ""` rather than `|| ""` so a legitimate 0 renders as "0" instead of
 * disappearing (stock counts and totals go through here).
 */
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

module.exports = { escapeHtml };
