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
export const getAbsoluteImageUrl = (imageUrl) => {
  if (!imageUrl) return '';
  
  // If it's already an absolute URL (http:// or https://), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // If it's a relative URL starting with /, prepend the API base URL
  if (imageUrl.startsWith('/')) {
    return `${getApiBaseUrl()}${imageUrl}`;
  }
  
  // If it doesn't start with /, assume it needs /images/ prefix
  return `${getApiBaseUrl()}/images/${imageUrl}`;
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
