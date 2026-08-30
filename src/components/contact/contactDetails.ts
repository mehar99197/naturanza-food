/**
 * Contact-detail helpers shared by the page's client panels and by the
 * structured data the route emits on the server.
 *
 * Kept in one module so the phone number a visitor taps and the one Google
 * reads can never normalise differently.
 */

/** Strips everything but digits and a leading `+`, for `tel:` and JSON-LD. */
export const normalizePhoneLink = (value: string | null | undefined): string =>
  String(value || "").replace(/[^\d+]/g, "");

/** Fallback centre when settings carry no usable coordinates: Lahore. */
export const DEFAULT_MAP_LATITUDE = 31.5204;
export const DEFAULT_MAP_LONGITUDE = 74.3587;
export const DEFAULT_MAP_LOCATION_LABEL = "Pakistan, Lahore";

/** Half-width of the OpenStreetMap viewport, in degrees. */
const BBOX_LNG_SPAN = 0.055;
const BBOX_LAT_SPAN = 0.06;

export interface MapLinks {
  embedUrl: string;
  directionsUrl: string;
}

/**
 * Builds the OpenStreetMap embed and the Google Maps directions link.
 *
 * Non-finite coordinates fall back to Lahore rather than producing a `NaN`
 * bounding box, which is what the source's `Number.isFinite` guards did.
 */
export const buildMapLinks = (
  latitude: number,
  longitude: number,
  locationLabel: string,
): MapLinks => {
  const safeLat = Number.isFinite(latitude) ? latitude : DEFAULT_MAP_LATITUDE;
  const safeLng = Number.isFinite(longitude) ? longitude : DEFAULT_MAP_LONGITUDE;
  const bboxLeft = (safeLng - BBOX_LNG_SPAN).toFixed(4);
  const bboxRight = (safeLng + BBOX_LNG_SPAN).toFixed(4);
  const bboxBottom = (safeLat - BBOX_LAT_SPAN).toFixed(4);
  const bboxTop = (safeLat + BBOX_LAT_SPAN).toFixed(4);

  return {
    embedUrl: `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
      `${bboxLeft},${bboxBottom},${bboxRight},${bboxTop}`,
    )}&layer=mapnik&marker=${encodeURIComponent(`${safeLat.toFixed(4)},${safeLng.toFixed(4)}`)}`,
    directionsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      locationLabel,
    )}`,
  };
};
