/**
 * Email authenticity checks used at registration to reject obviously fake
 * addresses BEFORE we create an account or send a verification code.
 *
 *  1) Disposable / temporary mailbox domains (mailinator, tempmail, …) are blocked.
 *  2) The email's domain must actually be able to receive mail (has an MX record,
 *     or at least an A/AAAA record as a fallback).
 *
 * This is the first filter; the 6-digit email verification code is the real proof
 * of ownership. Because the code backs this up, the DNS check fails OPEN on
 * transient lookup errors (network/timeout) so a DNS hiccup never blocks a real
 * user — a truly fake domain still can't deliver the code.
 */
const dns = require("dns").promises;

// Common disposable / throwaway email domains. Not exhaustive, but covers the
// providers people actually reach for when faking a signup.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "temp-mail.org", "10minutemail.com",
  "10minutemail.net", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.biz", "guerrillamail.de", "sharklasers.com", "grr.la", "spam4.me",
  "yopmail.com", "yopmail.net", "yopmail.fr", "cool.fr.nf", "jetable.fr.nf",
  "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf",
  "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
  "trashmail.com", "trashmail.net", "trash-mail.com", "trashmail.de", "wegwerfmail.de",
  "wegwerfmail.net", "wegwerfmail.org", "getnada.com", "nada.email", "dispostable.com",
  "maildrop.cc", "mailnesia.com", "mailcatch.com", "mintemail.com", "mytemp.email",
  "throwawaymail.com", "fakeinbox.com", "fake-mail.net", "tempinbox.com", "spamgourmet.com",
  "mailexpire.com", "tempr.email", "discard.email", "discardmail.com", "discardmail.de",
  "emailondeck.com", "emailfake.com", "fakemail.net", "tempmailo.com", "temp-mail.io",
  "tempmail.plus", "mohmal.com", "mailtemp.info", "burnermail.io", "33mail.com",
  "anonbox.net", "anonymbox.com", "spambox.us", "spambog.com", "spamfree24.org",
  "incognitomail.org", "deadaddress.com", "mailnull.com", "no-spam.ws", "objectmail.com",
  "proxymail.eu", "rcpt.at", "tempemail.net", "tempemail.com", "tempymail.com",
  "thankyou2010.com", "trbvm.com", "tmail.ws", "tmailinator.com", "veryrealemail.com",
  "wh4f.org", "willhackforfood.biz", "xoxy.net", "yep.it", "zoemail.com",
  "mailde.de", "mailde.info", "byom.de", "cuvox.de", "dayrep.com", "einrot.com",
  "fleckens.hu", "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com",
  "teleworm.us", "armyspy.com", "0clickemail.com", "20minutemail.com", "30minutemail.com",
  "tempail.com", "luxusmail.org", "inboxbear.com", "mailpoof.com", "harakirimail.com",
  "linshiyou.com", "tmpmail.org", "tmpmail.net", "minuteinbox.com", "1secmail.com",
  "1secmail.net", "1secmail.org", "kzccv.com", "qiott.com", "wuuvo.com", "icznn.com",
  "ezztt.com", "vjuum.com", "laafd.com", "txcct.com", "trbvn.com", "dropmail.me",
  "10mail.org", "emltmp.com", "tmpbox.net", "moakt.com", "moakt.co", "moakt.ws",
  "tmpeml.com", "tmpmail.io", "disbox.net", "fexbox.org", "fextemp.com", "vomoto.com",
  "smashmail.de", "spam4.me", "33mail.com", "mailsac.com", "inboxkitten.com",
]);

const getEmailDomain = (email) => {
  const parts = String(email || "").trim().toLowerCase().split("@");
  if (parts.length !== 2 || !parts[1]) {
    return null;
  }
  return parts[1];
};

const isDisposableEmail = (email) => {
  const domain = getEmailDomain(email);
  if (!domain) {
    return false;
  }
  return DISPOSABLE_DOMAINS.has(domain);
};

// Resolve with a hard timeout so a slow/stuck DNS server can't hang the request.
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("DNS_TIMEOUT")), ms)),
  ]);

/**
 * Returns true if the domain looks deliverable (has MX, or A/AAAA fallback).
 * Returns false ONLY when the domain clearly cannot receive mail (NXDOMAIN /
 * no usable records). On transient lookup errors it returns true (fail-open) —
 * the verification code still gates a real fake.
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
    // No MX: some valid domains accept mail via the A record. Check that too.
    try {
      const a = await withTimeout(dns.resolve(domain), 3000);
      return Array.isArray(a) && a.length > 0;
    } catch {
      return false;
    }
  } catch (error) {
    const code = error && error.code;
    // Domain definitively does not exist / has no records → it's fake.
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") {
      // Try the A-record fallback before declaring it dead.
      try {
        const a = await withTimeout(dns.resolve(domain), 3000);
        return Array.isArray(a) && a.length > 0;
      } catch {
        return false;
      }
    }
    // Any other error (timeout, SERVFAIL, network) → fail open; OTP will catch fakes.
    return true;
  }
};

module.exports = {
  isDisposableEmail,
  hasDeliverableDomain,
  getEmailDomain,
};
