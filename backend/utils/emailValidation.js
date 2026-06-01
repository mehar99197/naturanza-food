/**
 * Email authenticity checks used at registration to reject fake / disposable
 * addresses BEFORE we create an account or send a verification code.
 *
 * Disposable-mail services (Temp-Mail, etc.) rotate through hundreds of domains
 * and even hand out the OTP, so neither a hand-written list nor the verification
 * code alone is enough. We therefore check in layers and block if ANY layer says
 * disposable:
 *
 *   1) Whitelist of major providers (gmail, outlook, …) → allow instantly. This
 *      covers the vast majority of real signups and avoids hitting the live API.
 *   2) Curated hard-block list → offline backstop for domains we always reject
 *      (works even if the live API is unreachable).
 *   3) `mailchecker` → a large, maintained offline blocklist (thousands of
 *      domains: temp-mail.io/.org, mailinator, 1secmail, guerrillamail, …).
 *   4) `validator.pizza` (free, cached) → a LIVE list that catches rotating
 *      Temp-Mail domains the static lists miss (e.g. googxs.com). Fails OPEN on
 *      rate-limit/error so a live-service hiccup never blocks a real user.
 *
 * A separate MX/DNS check rejects domains that can't receive mail at all.
 */
const dns = require("dns").promises;
const mailchecker = require("mailchecker");

// Trusted mailbox providers — allow immediately, skip the blocklists + API.
const MAJOR_PROVIDERS = new Set([
  "gmail.com", "googlemail.com",
  "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "live.co.uk", "msn.com",
  "yahoo.com", "yahoo.co.uk", "yahoo.in", "ymail.com", "rocketmail.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "proton.me", "protonmail.com", "pm.me",
  "zoho.com", "zohomail.com", "gmx.com", "gmx.net", "gmx.de",
  "mail.com", "yandex.com", "yandex.ru", "hey.com", "fastmail.com",
]);

// Offline hard-block backstop (used even if the live API is down). `mailchecker`
// covers thousands more; these are extras + known rotating Temp-Mail domains.
const CURATED_DISPOSABLE = new Set([
  "googxs.com",
  "mailinator.com", "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.plus",
  "10minutemail.com", "10minutemail.net", "20minutemail.com", "minuteinbox.com",
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "sharklasers.com",
  "grr.la", "spam4.me", "yopmail.com", "yopmail.net", "yopmail.fr",
  "trashmail.com", "trash-mail.com", "wegwerfmail.de", "getnada.com", "nada.email",
  "dispostable.com", "maildrop.cc", "mailnesia.com", "mailcatch.com", "mintemail.com",
  "throwawaymail.com", "fakeinbox.com", "tempinbox.com", "spamgourmet.com",
  "tempr.email", "discard.email", "emailondeck.com", "emailfake.com", "tempmailo.com",
  "mohmal.com", "burnermail.io", "33mail.com", "moakt.com", "moakt.co", "moakt.ws",
  "dropmail.me", "1secmail.com", "1secmail.net", "1secmail.org", "mailsac.com",
  "inboxkitten.com", "harakirimail.com", "tmpmail.org", "tmpmail.net", "luxusmail.org",
]);

// Cache of live-API verdicts so repeat domains don't re-hit the rate-limited API.
const apiCache = new Map(); // domain -> { disposable, ts }
const API_TTL_MS = 24 * 60 * 60 * 1000;
const API_TIMEOUT_MS = 4000;

const getEmailDomain = (email) => {
  const parts = String(email || "").trim().toLowerCase().split("@");
  if (parts.length !== 2 || !parts[1]) {
    return null;
  }
  return parts[1];
};

// Live disposable lookup (validator.pizza). PII-free: we send only a probe
// localpart so the user's real address never leaves the server. Fails open.
const isDisposableViaApi = async (domain) => {
  const cached = apiCache.get(domain);
  if (cached && Date.now() - cached.ts < API_TTL_MS) {
    return cached.disposable;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://www.validator.pizza/email/probe@${encodeURIComponent(domain)}`,
      { signal: controller.signal, headers: { "User-Agent": "naturanzafood-signup" } },
    );
    if (!res.ok) {
      return false; // rate-limited / server error → fail open
    }
    const data = await res.json();
    const disposable = data && data.disposable === true;
    apiCache.set(domain, { disposable, ts: Date.now() });
    return disposable;
  } catch {
    return false; // timeout / network error → fail open
  } finally {
    clearTimeout(timer);
  }
};

/**
 * True if the email's domain is a disposable/temporary mailbox. Layered:
 * whitelist → curated → mailchecker (offline) → validator.pizza (live).
 */
const isDisposableEmail = async (email) => {
  const domain = getEmailDomain(email);
  if (!domain) {
    return false;
  }
  if (MAJOR_PROVIDERS.has(domain)) {
    return false;
  }
  if (CURATED_DISPOSABLE.has(domain)) {
    return true;
  }
  // mailchecker.isValid() returns false for disposable/blocklisted domains; the
  // localpart is a valid probe so a false result here means "disposable".
  if (!mailchecker.isValid(`probe@${domain}`)) {
    return true;
  }
  return isDisposableViaApi(domain);
};

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("DNS_TIMEOUT")), ms)),
  ]);

/**
 * Returns true if the domain looks deliverable (has MX, or A/AAAA fallback).
 * Returns false only when the domain clearly can't receive mail. Fails open on
 * transient lookup errors (the verification code still gates real fakes).
 */
const hasDeliverableDomain = async (email) => {
  const domain = getEmailDomain(email);
  if (!domain) {
    return false;
  }

  try {
    const mx = await withTimeout(dns.resolveMx(domain), 4000);
    if (Array.isArray(mx) && mx.some((record) => record && record.exchange)) {
      return true;
    }
    try {
      const a = await withTimeout(dns.resolve(domain), 3000);
      return Array.isArray(a) && a.length > 0;
    } catch {
      return false;
    }
  } catch (error) {
    const code = error && error.code;
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") {
      try {
        const a = await withTimeout(dns.resolve(domain), 3000);
        return Array.isArray(a) && a.length > 0;
      } catch {
        return false;
      }
    }
    return true; // transient (timeout/SERVFAIL/network) → fail open
  }
};

module.exports = {
  isDisposableEmail,
  hasDeliverableDomain,
  getEmailDomain,
};
