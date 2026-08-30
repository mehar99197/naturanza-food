/**
 * Image URL resolution, ported from frontend/src/lib/imageUtils.js.
 *
 * The URL-shaping algorithm below is unchanged. What had to change is where the
 * base URL comes from, because the two apps are not deployed the same way:
 *
 *   Vite  — dev server on :5173, Express on :5000. Two origins, so every image
 *           URL had to be made absolute against `import.meta.env.VITE_API_URL`,
 *           falling back to `window.location` plus VITE_API_PORT (default 5000).
 *   Next  — Next runs *inside* the Express process (backend/nextServer.js) and
 *           Express serves /images and /uploads itself. One origin. So the base
 *           is "" and these functions return root-relative paths, which resolve
 *           correctly during server rendering and in the browser alike.
 *
 * Carrying the port-guessing branch across would have actively broken things:
 * it would append :5000 to a same-origin URL. `import.meta.env` does not exist
 * under Next either, so `NEXT_PUBLIC_API_URL` replaces `VITE_API_URL` for the
 * one case that still needs it — images served from a separate host or CDN.
 *
 * Despite the name, `getAbsoluteImageUrl` returns a *relative* path in the
 * normal same-origin case. For a genuinely absolute URL (og:image, JSON-LD,
 * emails) wrap the result in `absoluteUrl()` from @/config/site.
 */

/**
 * Origin that serves /images and /uploads, with no trailing slash.
 *
 * Returns "" when images come from the same origin as the page — which is the
 * default, since Express serves both.
 */
export const getApiBaseUrl = (): string => {
  const configuredApiUrl = String(process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (configuredApiUrl) {
    // Remove /api suffix if present
    return configuredApiUrl.replace(/\/api$/, "");
  }

  return "";
};

export interface AbsoluteImageUrlOptions {
  /**
   * Folder under /images to assume for a bare filename with no path of its own,
   * e.g. "products" turns "honey.jpg" into "/images/products/honey.jpg".
   */
  defaultFolder?: string | null;
}

/**
 * Resolves whatever the database holds for an image into a URL the browser can
 * load.
 *
 * The stored values are inconsistent by history — absolute URLs, Windows
 * backslash paths, "/images/x.png", "uploads/x.png", and bare filenames all
 * appear — so this normalises separators and then works from the *last*
 * /images/ or /uploads/ marker in the string. Working from the marker rather
 * than the start is what makes a stale absolute URL from an old host resolve
 * against the current one.
 */
export const getAbsoluteImageUrl = (
  imageUrl: string | null | undefined,
  options: AbsoluteImageUrlOptions = {},
): string => {
  const rawValue = String(imageUrl || "").trim();
  if (!rawValue) return "";

  const normalized = rawValue.replace(/\\/g, "/");
  if (normalized.startsWith("data:") || normalized.startsWith("blob:")) {
    return normalized;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  const apiBaseUrl = getApiBaseUrl();
  const lower = normalized.toLowerCase();
  const rootMarkers = ["/images/", "/uploads/"];

  for (const marker of rootMarkers) {
    const markerIndex = lower.indexOf(marker);
    if (markerIndex !== -1) {
      const relativePath = normalized.slice(markerIndex);
      return `${apiBaseUrl}${relativePath.startsWith("/") ? "" : "/"}${relativePath}`;
    }
  }

  if (normalized.startsWith("/")) {
    return `${apiBaseUrl}${normalized}`;
  }

  if (/^(images|uploads)\//i.test(normalized)) {
    return `${apiBaseUrl}/${normalized}`;
  }

  const defaultFolder = String(options?.defaultFolder || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (defaultFolder && !normalized.includes("/")) {
    return `${apiBaseUrl}/images/${defaultFolder}/${normalized}`;
  }

  return `${apiBaseUrl}/images/${normalized}`;
};

/** Stand-in shown when a product has no image. */
export const getProductPlaceholder = (): string =>
  `${getApiBaseUrl()}/images/placeholder-product.png`;

/** Stand-in shown when a category has no image. */
export const getCategoryPlaceholder = (): string =>
  `${getApiBaseUrl()}/images/placeholder-category.png`;
