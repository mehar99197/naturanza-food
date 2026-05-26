/**
 * Utility functions for handling image URLs
 */

/**
 * Get the API base URL
 */
export const getApiBaseUrl = () => {
  const configuredApiUrl = String(import.meta.env.VITE_API_URL || "").trim();
  if (configuredApiUrl) {
    // Remove /api suffix if present
    return configuredApiUrl.replace(/\/api$/, '');
  }

  if (typeof window !== "undefined") {
    const protocol = String(window.location.protocol || "http:");
    const hostname = String(window.location.hostname || "localhost");
    const apiPort = Number.parseInt(
      String(import.meta.env.VITE_API_PORT || "5000"),
      10,
    );
    const safePort = Number.isFinite(apiPort) && apiPort > 0 ? apiPort : 5000;

    return `${protocol}//${hostname}:${safePort}`;
  }

  return "http://localhost:5000";
};

/**
 * Convert a relative image URL to an absolute URL
 * @param {string} imageUrl - The image URL (can be relative or absolute)
 * @returns {string} - The absolute image URL
 */
export const getAbsoluteImageUrl = (imageUrl, options = {}) => {
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

/**
 * Get a placeholder image URL for products
 */
export const getProductPlaceholder = () => {
  return `${getApiBaseUrl()}/images/placeholder-product.png`;
};

/**
 * Get a placeholder image URL for categories
 */
export const getCategoryPlaceholder = () => {
  return `${getApiBaseUrl()}/images/placeholder-category.png`;
};
