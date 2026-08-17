const { safelist, theme, plugins } = require("../tailwind.theme.cjs");

/**
 * The Vite app's Tailwind config. Everything except `content` comes from the
 * shared theme at the repo root, which the Next.js app reads too — one design
 * system, two build tools, no drift while pages move between them.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist,
  theme,
  plugins,
};
