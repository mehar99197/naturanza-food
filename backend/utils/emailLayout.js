/**
 * Shared, email-client-safe building blocks for every Naturanza Food email.
 *
 * Email HTML is not web HTML: Outlook ignores CSS gradients, shadows and
 * border-radius, and Gmail strips <style> blocks. So every coloured surface
 * here sets a solid `bgcolor` / `background-color` first and only layers the
 * gradient on top for clients that support it.
 */

const { escapeHtml } = require("./htmlEscape");

const BRAND = {
  name: "Naturanza Food",
  tagline: "Pure. Natural. Healthy.",
  siteUrl: (process.env.EMAIL_SITE_URL || "https://naturanzafood.com").replace(/\/+$/, ""),
  // Must be an absolute public URL: email clients cannot load relative or localhost paths.
  logoUrl: process.env.EMAIL_LOGO_URL || "https://naturanzafood.com/images/logo.png",
  supportEmail: process.env.EMAIL_SUPPORT_ADDRESS || "support@naturanzafood.com",
  whatsappNumber: process.env.EMAIL_SUPPORT_WHATSAPP || "923409502646",
  address: process.env.EMAIL_BUSINESS_ADDRESS || "Nizam Pura, Chunian, District Kasur, Punjab, Pakistan",
};

const ACCENTS = {
  green: { solid: "#16a34a", gradientEnd: "#059669" },
  red: { solid: "#dc2626", gradientEnd: "#b91c1c" },
};

const normalizeWhatsappDigits = (value, fallback) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || fallback;
};

const resolveBrand = (brandOverride = null) => {
  if (!brandOverride || typeof brandOverride !== "object") {
    return BRAND;
  }

  const name =
    String(brandOverride.storeName ?? brandOverride.name ?? "").trim() || BRAND.name;
  const supportEmail =
    String(brandOverride.supportEmail ?? brandOverride.storeEmail ?? "").trim() ||
    BRAND.supportEmail;
  const address =
    String(brandOverride.address ?? "").trim() || BRAND.address;
  const whatsappRaw =
    String(brandOverride.whatsappNumber ?? "").trim() ||
    String(brandOverride.storePhone ?? "").trim();
  const whatsappNumber = normalizeWhatsappDigits(whatsappRaw, BRAND.whatsappNumber);
  const siteUrl =
    String(brandOverride.siteUrl ?? "").trim().replace(/\/+$/, "") || BRAND.siteUrl;
  const logoUrl = String(brandOverride.logoUrl ?? "").trim() || BRAND.logoUrl;
  const tagline = String(brandOverride.tagline ?? "").trim() || BRAND.tagline;

  return {
    ...BRAND,
    name,
    tagline,
    siteUrl,
    logoUrl,
    supportEmail,
    whatsappNumber,
    address,
  };
};

const formatWhatsappDisplay = (digits) => {
  const clean = String(digits || "").replace(/\D/g, "");
  const match = clean.match(/^92(\d{3})(\d{7})$/);
  return match ? `+92 ${match[1]} ${match[2]}` : `+${clean}`;
};

/**
 * Bulletproof CTA button: the colour lives on the table cell (bgcolor), so the
 * button stays visible in Outlook, where an <a> background is dropped.
 */
const renderButton = ({ href, label, accent = "green" }) => {
  const { solid, gradientEnd } = ACCENTS[accent] || ACCENTS.green;
  const safeHref = escapeHtml(href);
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding: 8px 0 28px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" bgcolor="${solid}" style="background-color: ${solid}; background-image: linear-gradient(135deg, ${solid} 0%, ${gradientEnd} 100%); border-radius: 10px;">
                          <a href="${safeHref}" target="_blank" style="display: inline-block; padding: 15px 36px; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 10px;">${escapeHtml(label)}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
};

/** Plain "copy this link" fallback, kept small and muted so the long URL does not dominate. */
const renderLinkFallback = (href) => {
  const safeHref = escapeHtml(href);
  return `
              <p style="margin: 0 0 6px; color: #64748b; font-size: 13px; line-height: 1.5;">
                Button not working? Copy this link into your browser:
              </p>
              <p style="margin: 0 0 24px; padding: 10px 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; word-break: break-all; font-size: 12px; line-height: 1.5;">
                <a href="${safeHref}" style="color: #64748b; text-decoration: underline;">${safeHref}</a>
              </p>`;
};

const renderNotice = ({ title, body, tone = "warning" }) => {
  const palette =
    tone === "danger"
      ? { bg: "#fef2f2", border: "#dc2626", text: "#7f1d1d" }
      : { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" };
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px;">
                <tr>
                  <td bgcolor="${palette.bg}" style="background-color: ${palette.bg}; border-left: 4px solid ${palette.border}; border-radius: 8px; padding: 14px 18px; color: ${palette.text}; font-size: 14px; line-height: 1.55;">
                    ${title ? `<strong>${escapeHtml(title)}</strong><br>` : ""}${escapeHtml(body)}
                  </td>
                </tr>
              </table>`;
};

/**
 * "Request details" table (time, device, IP, location) so the recipient can
 * tell whether an account action really came from them.
 */
const PAKISTAN_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  dateStyle: "medium",
  timeStyle: "short",
});

const formatPakistanTime = (date = new Date()) => `${PAKISTAN_TIME.format(date)} (PKT)`;

const buildRequestDetails = ({ device, ip, location, at } = {}) =>
  [
    ["Time", formatPakistanTime(at)],
    ["Device", device],
    ["Location", location],
    ["IP address", ip],
  ].filter(([, value]) => value);

const renderRequestDetails = (context) => {
  const rows = buildRequestDetails(context)
    .map(
      ([label, value]) => `
                      <tr>
                        <td style="padding: 4px 0; color: #64748b; font-size: 13px;">${label}</td>
                        <td style="padding: 4px 0; color: #0f172a; font-size: 13px; font-weight: 600; text-align: right;">${escapeHtml(value)}</td>
                      </tr>`,
    )
    .join("");
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 24px;">
                <tr>
                  <td bgcolor="#f8fafc" style="background-color: #f8fafc; border-radius: 10px; padding: 14px 18px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows}
                    </table>
                  </td>
                </tr>
              </table>`;
};

const requestDetailsToText = (context) =>
  buildRequestDetails(context)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

const renderFooter = ({ footerNote, brand = null }) => {
  const resolvedBrand = resolveBrand(brand);
  const year = new Date().getFullYear();
  const whatsappDisplay = formatWhatsappDisplay(resolvedBrand.whatsappNumber);
  const link = "color: #16a34a; text-decoration: none;";
  return `
          <tr>
            <td bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              ${footerNote ? `<p style="margin: 0 0 12px; color: #64748b; font-size: 12px; line-height: 1.6;">${footerNote}</p>` : ""}
              <p style="margin: 0 0 8px; color: #475569; font-size: 13px; line-height: 1.6;">
                Need help? <a href="mailto:${escapeHtml(resolvedBrand.supportEmail)}" style="${link}">${escapeHtml(resolvedBrand.supportEmail)}</a>
                &nbsp;·&nbsp; WhatsApp <a href="https://wa.me/${escapeHtml(resolvedBrand.whatsappNumber)}" style="${link}">${escapeHtml(whatsappDisplay)}</a>
              </p>
              <p style="margin: 0 0 8px; color: #94a3b8; font-size: 12px; line-height: 1.6;">
                <a href="${escapeHtml(resolvedBrand.siteUrl)}" style="color: #94a3b8; text-decoration: underline;">${escapeHtml(resolvedBrand.siteUrl.replace(/^https?:\/\//, ""))}</a>
                &nbsp;·&nbsp; ${escapeHtml(resolvedBrand.address)}
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                © ${year} ${escapeHtml(resolvedBrand.name)}. All rights reserved.
              </p>
            </td>
          </tr>`;
};

/**
 * Full email document: hidden preheader, branded header with logo, content, footer.
 *
 * @param {object} options
 * @param {string} options.title        <title> of the document (plain text)
 * @param {string} options.preheader    Inbox preview line shown next to the subject (plain text)
 * @param {string} [options.heading]    Optional heading under the logo (plain text)
 * @param {string} [options.subheading] Optional line under the heading (plain text)
 * @param {"green"|"red"} [options.accent]
 * @param {string} options.contentHtml  Pre-escaped body HTML
 * @param {string} [options.footerNote] Pre-escaped extra footer line (e.g. unsubscribe)
 * @param {object} [options.brand]      Optional brand overrides ({ storeName, supportEmail, address, whatsappNumber })
 */
const renderEmailLayout = ({
  title,
  preheader,
  heading,
  subheading,
  accent = "green",
  contentHtml,
  footerNote = "",
  brand = null,
}) => {
  const resolvedBrand = resolveBrand(brand);
  const resolvedSubheading =
    subheading === undefined ? resolvedBrand.tagline : subheading;
  const { solid, gradientEnd } = ACCENTS[accent] || ACCENTS.green;
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f0fdf4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #f0fdf4; opacity: 0;">
    ${escapeHtml(preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}
  </div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f0fdf4" style="background-color: #f0fdf4;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" bgcolor="#ffffff" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden;">
          <tr>
            <td align="center" bgcolor="${solid}" style="background-color: ${solid}; background-image: linear-gradient(135deg, ${solid} 0%, ${gradientEnd} 100%); padding: 32px 40px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td bgcolor="#ffffff" style="background-color: #ffffff; border-radius: 12px; padding: 12px 20px;">
                    <a href="${escapeHtml(resolvedBrand.siteUrl)}" target="_blank" style="color: #15803d; text-decoration: none; font-size: 20px; font-weight: 700;"><img src="${escapeHtml(resolvedBrand.logoUrl)}" width="180" alt="${escapeHtml(resolvedBrand.name)}" style="display: block; width: 180px; max-width: 180px; height: auto; border: 0; color: #15803d; font-size: 20px; font-weight: 700;" /></a>
                  </td>
                </tr>
              </table>
              ${heading ? `<h1 style="margin: 20px 0 0; color: #ffffff; font-size: 24px; font-weight: 700; line-height: 1.3;">${escapeHtml(heading)}</h1>` : ""}
              ${resolvedSubheading ? `<p style="margin: ${heading ? "8px" : "12px"} 0 0; color: #ecfdf5; font-size: 14px;">${escapeHtml(resolvedSubheading)}</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding: 40px; color: #475569; font-size: 16px; line-height: 1.6;">
${contentHtml}
            </td>
          </tr>
${renderFooter({ footerNote, brand: resolvedBrand })}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

module.exports = {
  BRAND,
  resolveBrand,
  renderEmailLayout,
  renderButton,
  renderLinkFallback,
  renderNotice,
  renderRequestDetails,
  requestDetailsToText,
};
