// Canonical social profile helpers for SEO metadata and Schema.org JSON-LD.
// Keeps structured data aligned with the store's actual configured profiles
// instead of emitting unused Twitter handles or stale placeholder URLs.

export const DEFAULT_SOCIAL_PROFILES = {
  facebookUrl: "https://www.facebook.com/share/18x8ZMDq2H/",
  instagramUrl: "https://www.instagram.com/naturanzafood",
  tiktokUrl: "https://www.tiktok.com/@naturanza.food",
};

const TRACKING_QUERY_PARAMS = new Set(["igsh", "igshid", "_r", "_t", "fbclid", "si"]);

export const cleanSocialUrl = (rawValue) => {
  const trimmed = String(rawValue || "").trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    for (const key of [...parsed.searchParams.keys()]) {
      const lowerKey = key.toLowerCase();
      if (TRACKING_QUERY_PARAMS.has(lowerKey) || lowerKey.startsWith("utm_")) {
        parsed.searchParams.delete(key);
      }
    }

    return parsed.toString();
  } catch {
    return null;
  }
};

const normalizePhoneDigits = (value) => String(value || "").replace(/[^\d]/g, "");

/**
 * Returns deduplicated, clean social profile URLs from live store settings.
 * Falls back to the store's active Facebook/Instagram/TikTok profiles only when
 * settings have not yet hydrated any social URLs.
 */
export const getConfiguredSocialUrls = (
  settings = {},
  { includeWhatsapp = false, fallbackWhatsapp = "" } = {},
) => {
  const configuredKeys = [
    settings?.facebookUrl,
    settings?.instagramUrl,
    settings?.tiktokUrl,
    settings?.twitterUrl,
    settings?.youtubeUrl,
  ];

  const cleanedConfigured = configuredKeys
    .map(cleanSocialUrl)
    .filter(Boolean);

  const baseUrls =
    cleanedConfigured.length > 0
      ? cleanedConfigured
      : [
          DEFAULT_SOCIAL_PROFILES.facebookUrl,
          DEFAULT_SOCIAL_PROFILES.instagramUrl,
          DEFAULT_SOCIAL_PROFILES.tiktokUrl,
        ];

  const urls = [...new Set(baseUrls)];

  if (includeWhatsapp && settings?.whatsappEnabled !== false) {
    const whatsappDigits = normalizePhoneDigits(
      settings?.whatsappNumber || settings?.storePhone || fallbackWhatsapp,
    );
    if (whatsappDigits) {
      urls.push(`https://wa.me/${whatsappDigits}`);
    }
  }

  return [...new Set(urls)];
};

/**
 * Extracts a Twitter/X @handle ONLY when a Twitter/X profile URL is explicitly
 * configured in store settings. Returns null when Twitter is unused.
 */
export const extractTwitterHandle = (twitterUrl) => {
  const cleaned = cleanSocialUrl(twitterUrl);
  if (!cleaned) return null;

  try {
    const parsed = new URL(cleaned);
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname.endsWith("twitter.com") && !hostname.endsWith("x.com")) {
      return null;
    }
    const segment = parsed.pathname
      .split("/")
      .map((part) => part.trim())
      .find(Boolean);
    if (!segment) return null;
    const cleanHandle = segment.replace(/^@+/, "");
    if (!/^[A-Za-z0-9_]{1,15}$/.test(cleanHandle)) {
      return null;
    }
    return `@${cleanHandle}`;
  } catch {
    return null;
  }
};
