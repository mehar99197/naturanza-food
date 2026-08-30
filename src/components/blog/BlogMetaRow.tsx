import { CalendarDays, Clock3 } from "lucide-react";

import type { BlogCardPost } from "./postFields";

/**
 * Read time and date under a card, unchanged from Blog.jsx's `MetaRow`.
 *
 * Takes the already-formatted date string rather than a Date; see `BlogCardPost`
 * for why the formatting has to happen on the server.
 */
export function BlogMetaRow({
  post,
  className = "",
}: {
  post: Pick<BlogCardPost, "readTime" | "date">;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 text-[13px] text-slate-500 ${className}`}>
      <span className="inline-flex items-center gap-1">
        <Clock3 className="h-3.5 w-3.5" /> {post.readTime || "—"}
      </span>
      <span className="inline-flex items-center gap-1">
        <CalendarDays className="h-3.5 w-3.5" /> {post.date}
      </span>
    </div>
  );
}
