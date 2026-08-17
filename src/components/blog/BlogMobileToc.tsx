"use client";

import { ChevronDown, ChevronUp, List } from "lucide-react";
import { useState } from "react";

import { BlogTocList } from "./BlogTocList";
import type { TocItem } from "./markdown/toc";

/** The collapsible contents panel shown above the article below `lg`. */
export function BlogMobileToc({ items }: { items: TocItem[] }) {
  const [open, setOpen] = useState(false);

  if (!items.length) return null;

  return (
    <div className="lg:hidden mb-6 rounded-xl border border-green-100 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700"
      >
        <span className="flex items-center gap-2">
          <List className="h-4 w-4 text-green-600" /> Table of Contents
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && (
        <div className="border-t border-green-50 px-4 py-3">
          <BlogTocList items={items} onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
