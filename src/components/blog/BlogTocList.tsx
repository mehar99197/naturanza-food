"use client";

import { List } from "lucide-react";

import type { TocItem } from "./markdown/toc";
import { scrollToHeading, useActiveHeading } from "./useReadingProgress";

/**
 * The contents list, unchanged from BlogPost.jsx's `TOCSidebar`.
 *
 * It tracks the active heading itself rather than being handed one, so the
 * desktop sidebar and the mobile accordion can each render it without the page
 * shell having to become a Client Component to hold the state between them. Both
 * copies read the same shared scroll listener — see ./useReadingProgress.
 */
export function BlogTocList({
  items,
  onNavigate,
}: {
  items: TocItem[];
  /** Lets the mobile accordion close itself once a link is followed. */
  onNavigate?: () => void;
}) {
  const activeId = useActiveHeading(items.map((item) => item.id));

  if (!items.length) return null;

  return (
    <nav aria-label="Table of contents">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3 pb-2 border-b border-slate-100">
        <List className="h-3.5 w-3.5 text-green-600" /> Contents
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: item.level > 2 ? "10px" : undefined }}>
            <button
              onClick={() => {
                scrollToHeading(item.id);
                onNavigate?.();
              }}
              className={`text-left w-full text-[13px] leading-snug py-1.5 px-2.5 rounded-lg transition-all ${
                activeId === item.id
                  ? "bg-green-50 text-green-700 font-semibold border-l-2 border-green-500 pl-2"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
