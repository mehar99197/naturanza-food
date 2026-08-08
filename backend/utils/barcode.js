/**
 * Retail barcode helpers (EAN-13 / UPC-A / EAN-8).
 *
 * Products carry a scannable 1D barcode so they can be sold through a physical
 * store's POS terminal. Two sources are supported:
 *
 *   1. A REAL barcode the business owns (GS1-issued EAN-13, or a UPC-A/EAN-8
 *      already printed on the packaging). The admin pastes it into the product
 *      form and it is stored verbatim after check-digit validation.
 *
 *   2. An AUTO-GENERATED internal EAN-13, used when no real code is supplied.
 *      It uses a GS1 "restricted distribution" prefix (200-299), which the GS1
 *      spec reserves for in-store / internal circulation. Every retail scanner
 *      reads these, but they are NOT globally unique — a store must map the code
 *      to the product in its own POS database once. To get globally unique
 *      codes, buy a GS1 company prefix and paste the issued EAN-13 instead.
 *
 * Override the internal prefix with BARCODE_PREFIX (must stay within 200-299).
 */

const crypto = require("crypto");

const DEFAULT_INTERNAL_PREFIX = "200";
const SERIAL_LENGTH = 9;
const VALID_LENGTHS = new Set([8, 12, 13]);

const resolveInternalPrefix = () => {
  const configured = String(process.env.BARCODE_PREFIX || "").replace(/\D/g, "");

  // Anything outside the restricted-distribution range would claim a real GS1
  // company prefix we do not own, so fall back rather than emit a fake code.
  if (configured.length === 3) {
    const numeric = Number.parseInt(configured, 10);
    if (numeric >= 200 && numeric <= 299) {
      return configured;
    }
  }

  return DEFAULT_INTERNAL_PREFIX;
};

/**
 * Modulo-10 check digit shared by EAN-13, UPC-A and EAN-8.
 * Weights alternate 3/1 from the right, so the parity depends on body length.
 */
const computeCheckDigit = (body) => {
  const digits = String(body).split("").map(Number);
  const sum = digits.reduce((total, digit, index) => {
    // Rightmost body digit always carries weight 3.
    const weight = (digits.length - index) % 2 === 1 ? 3 : 1;
    return total + digit * weight;
  }, 0);

  return (10 - (sum % 10)) % 10;
};

const hasValidCheckDigit = (code) => {
  const body = code.slice(0, -1);
  const provided = Number(code.slice(-1));
  return computeCheckDigit(body) === provided;
};

/**
 * Deterministic internal EAN-13 for a product id: prefix + zero-padded serial
 * + check digit. Stable across regenerations so reprinted labels keep scanning.
 */
const buildInternalEan13 = (productId) => {
  const serial = String(Number(productId) || 0).padStart(SERIAL_LENGTH, "0");

  if (serial.length > SERIAL_LENGTH) {
    throw new Error(`Product id ${productId} exceeds the internal barcode serial range`);
  }

  const body = `${resolveInternalPrefix()}${serial}`;
  return `${body}${computeCheckDigit(body)}`;
};

/**
 * Random internal EAN-13 for a newly created product. The database uniqueness
 * check is performed by the product model before this value is persisted.
 */
const buildRandomInternalEan13 = () => {
  const serial = String(crypto.randomInt(0, 10 ** SERIAL_LENGTH)).padStart(
    SERIAL_LENGTH,
    "0",
  );
  const body = `${resolveInternalPrefix()}${serial}`;
  return `${body}${computeCheckDigit(body)}`;
};

/**
 * Validate + normalize an admin-supplied barcode.
 * Returns the clean digit string, or null when the input is blank.
 * Throws when the value is present but not a scannable retail symbology.
 */
const normalizeBarcode = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const digits = raw.replace(/[\s-]/g, "");

  if (!/^\d+$/.test(digits)) {
    throw new Error("Barcode must contain digits only");
  }

  if (!VALID_LENGTHS.has(digits.length)) {
    throw new Error(
      "Barcode must be 13 digits (EAN-13), 12 digits (UPC-A) or 8 digits (EAN-8)",
    );
  }

  if (!hasValidCheckDigit(digits)) {
    throw new Error("Barcode check digit is invalid — verify the number and try again");
  }

  return digits;
};

module.exports = {
  buildInternalEan13,
  buildRandomInternalEan13,
  normalizeBarcode,
};
