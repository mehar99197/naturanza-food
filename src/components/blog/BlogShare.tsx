"use client";

import { Check, Copy } from "lucide-react";

import { useCopyLink } from "./useCopyLink";
import { WhatsAppIcon } from "./WhatsAppIcon";

/**
 * Sharing controls, unchanged from BlogPost.jsx.
 *
 * Client Components because "copy link" needs the clipboard and a two-second
 * confirmation. The WhatsApp link beside it is a plain anchor and needs nothing,
 * but it sits inside the same flex row, so it is cheaper to keep them together
 * than to split the row across a boundary.
 *
 * `waUrl` is built on the server from the canonical article URL rather than from
 * `window.location`, so a shared link never carries a tracking query string that
 * happened to be on the reader's address bar.
 */

export function BlogShareActions({ waUrl }: { waUrl: string }) {
  const { copied, copy } = useCopyLink();

  return (
    <div className="flex items-center gap-2">
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/25"
        aria-label="Share on WhatsApp"
      >
        <WhatsAppIcon /> WhatsApp
      </a>
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/25"
        aria-label="Copy link"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}

export function BlogShareCard({ waUrl }: { waUrl: string }) {
  const { copied, copy } = useCopyLink();

  return (
    <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Share</p>
      <div className="flex flex-col gap-2">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-100"
        >
          <WhatsAppIcon /> Share on WhatsApp
        </a>
        <button
          onClick={copy}
          className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          {copied ? "Link copied!" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
