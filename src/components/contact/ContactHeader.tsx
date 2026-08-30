"use client";

// "use client": reveal-on-scroll. The copy is static and server-rendered; only
// the `active` class that fades it in is decided in the browser.

import { useScrollReveal } from "@/hooks/useScrollReveal";

export function ContactHeader() {
  const { ref: headerRef, isVisible: headerVisible } = useScrollReveal();

  return (
    <div
      className={`text-center mb-10 sm:mb-12 reveal reveal-left ${
        headerVisible ? "active" : ""
      }`}
      ref={headerRef}
    >
      <span className="text-[#3d7a3d] font-medium text-[11px] uppercase tracking-wider">
        Get in Touch
      </span>
      <h1 className="font-display text-xl md:text-2xl font-bold text-[#2d3a2d] mt-2 mb-3">
        Contact Us
      </h1>
      <p
        className="text-[#6b7a6b] max-w-2xl mx-auto text-sm"
      >
        Have a question or feedback? We would love to hear from you. Reach
        out to us and we will get back to you as soon as possible.
      </p>
    </div>
  );
}
