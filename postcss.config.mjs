/**
 * Matches frontend/postcss.config.js so the shared stylesheet is processed the
 * same way by both build tools.
 *
 * @type {import('postcss-load-config').Config}
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
