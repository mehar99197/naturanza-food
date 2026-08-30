"use client";

import { useState, type ReactNode } from "react";

import { DETAIL_SECTIONS, type DetailSectionKey } from "./constants";

/**
 * The phone accordion over the same four sections the desktop tabs show.
 *
 * Description starts open, and clicking an open header closes it — so all four
 * can be collapsed at once, which is why the state is a key *or* the empty
 * string rather than always a key. Preserved from the original.
 *
 * Like ProductTabs, the bodies arrive prerendered from the server.
 */
export interface ProductMobileSectionsProps {
  panels: Record<DetailSectionKey, ReactNode>;
}

export function ProductMobileSections({ panels }: ProductMobileSectionsProps) {
  const [openSection, setOpenSection] = useState<DetailSectionKey | "">("description");

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm">
      {DETAIL_SECTIONS.map((section) => {
        const isOpen = openSection === section.key;

        return (
          <div key={section.key} className="border-b border-gray-100 last:border-b-0">
            <button
              type="button"
              onClick={() => setOpenSection((prev) => (prev === section.key ? "" : section.key))}
              className="flex w-full items-center justify-between py-3 text-left"
            >
              <span className="text-sm font-semibold text-gray-900">{section.label}</span>
              <span className="text-lg font-semibold text-gray-500">{isOpen ? "-" : "+"}</span>
            </button>
            {isOpen ? <div className="pb-3">{panels[section.key]}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
