"use client";

import { useState, type ReactNode } from "react";

import { DETAIL_SECTIONS, type DetailSectionKey } from "./constants";

/**
 * The desktop Description / Ingredients / Benefits / Usage tab strip.
 *
 * "use client" for the selected-tab state alone. The section bodies arrive as
 * `panels` — nodes the server already rendered — so nothing about the copy, the
 * markdown-ish list parsing, or the lucide icons inside it is shipped to the
 * browser. Only the strip's own click handling is.
 */
export interface ProductTabsProps {
  /** One prerendered body per section key, built on the server. */
  panels: Record<DetailSectionKey, ReactNode>;
}

export function ProductTabs({ panels }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<DetailSectionKey>("description");

  return (
    <div className="mt-10 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
      <div className="grid grid-cols-4 gap-2 border-b border-emerald-100 bg-[#f5faf5] p-2">
        {DETAIL_SECTIONS.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => setActiveTab(section.key)}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === section.key
                ? "bg-emerald-600 text-white shadow-[0_8px_20px_rgba(5,150,105,0.28)]"
                : "text-gray-600 hover:bg-white"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>
      <div className="p-6 md:p-7">{panels[activeTab]}</div>
    </div>
  );
}
