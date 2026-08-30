import type { NextConfig } from "next";

/**
 * Next.js runs *inside* the existing Express process (see backend/nextServer.js).
 * Express owns /api, /images and /uploads; Next owns page rendering. That split is
 * why there are no rewrites here — routing is decided in the composition root, not
 * by Next, so the two never race to answer the same request.
 */
const nextConfig: NextConfig = {
  // Express already strips its own fingerprint via app.disable("x-powered-by").
  // Next re-adds one unless told not to.
  poweredByHeader: false,

  reactStrictMode: true,

  // mysql2 must not be bundled: it loads native/optional drivers at runtime and a
  // bundled copy would also create a second connection pool alongside Express's.
  serverExternalPackages: ["mysql2", "mysql2/promise"],

  typescript: {
    // Type errors must fail the production build. Never set this to true.
    ignoreBuildErrors: false,
  },

  images: {
    // Product and blog imagery is served by Express from persistent-uploads, on
    // the same origin. Local paths need no remote patterns.
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 480, 640, 828, 1080, 1200, 1920],
  },

  experimental: {
    // Keeps the client bundle from pulling a whole icon/UI package in for a few
    // named imports — the current SPA ships 612 kB of first-load JS, much of it
    // from exactly this pattern.
    optimizePackageImports: ["lucide-react", "date-fns", "framer-motion"],
  },
};

export default nextConfig;
