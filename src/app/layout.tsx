import type { Metadata, Viewport } from "next";

import {
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  LOCALE,
  SITE_NAME,
  SITE_URL,
} from "@/config/site";

import "./globals.css";

/**
 * Site-wide defaults. Each page overrides what it needs through its own
 * generateMetadata; anything it leaves alone falls back to these, so a new page
 * can never ship with an empty title or a missing social preview.
 *
 * metadataBase is what lets every other URL here stay relative — Next resolves
 * canonicals and OG images against it.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    // Migrated pages set a bare title; the site name is appended once, here.
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: LOCALE,
    url: SITE_URL,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: DEFAULT_OG_IMAGE, alt: `${SITE_NAME} - Premium Organic & Natural Products` }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/images/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/images/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/images/icon-192.png", sizes: "192x192" }],
  },
  manifest: "/manifest.json",
  other: {
    "geo.region": "PK",
    "geo.placename": "Pakistan",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#22c55e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // <body> carries no classes on purpose: frontend/index.html renders a bare
    // body too, and every rule that styles it lives in styles/app.css, which
    // both apps share. Adding Tailwind utilities here would style the Next
    // pages differently from the ones still served by the Vite build.
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
