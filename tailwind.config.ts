import type { Config } from "tailwindcss";

// Shared with the Vite app so a migrated page keeps the exact design it had.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { safelist, theme, plugins } = require("./tailwind.theme.cjs");

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  safelist,
  theme,
  plugins,
};

export default config;
