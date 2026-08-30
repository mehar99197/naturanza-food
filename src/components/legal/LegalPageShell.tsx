import type { ReactNode } from "react";

import type { LegalHeader } from "./types";

/**
 * The page frame shared by FAQ, shipping, returns, terms, privacy and cookies:
 * the cream full-height background, the site container, and the centred heading
 * block.
 *
 * The source rendered its own `<main className="pt-24 pb-16 …">`, but the
 * storefront layout already provides `<main id="main-content">`, and nesting a
 * second `<main>` inside it is invalid — a screen reader is told there are two
 * primary landmarks and the skip link no longer identifies one of them. The
 * element becomes a `<div>` here and every class is carried across unchanged, so
 * the rendering is identical. `/contact` and `/about` were ported the same way.
 *
 * A Server Component: nothing below this is interactive.
 */
export function LegalPageShell({
  header,
  children,
}: {
  header: LegalHeader;
  children: ReactNode;
}) {
  const { Icon, eyebrow, title, intro, lastUpdated } = header;

  return (
    <div className="pt-24 pb-16 min-h-screen bg-[#faf8f3]">
      <div className="container-custom">
        <header className="text-center mb-10">
          <span className="inline-flex items-center gap-2 text-[#3d7a3d] font-semibold text-xs uppercase tracking-wider">
            <Icon className="w-4 h-4" />
            {eyebrow}
          </span>
          <h1 className="text-2xl md:text-4xl font-bold text-[#2d3a2d] mt-3">{title}</h1>
          <p className="text-sm md:text-base text-[#6b7a6b] mt-3 max-w-2xl mx-auto">
            {intro}
          </p>
          {lastUpdated ? (
            <p className="text-xs text-[#8a958a] mt-2">{lastUpdated}</p>
          ) : null}
        </header>

        {children}
      </div>
    </div>
  );
}
