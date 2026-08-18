import type { PolicyNote } from "./types";

/**
 * The green panel that closes each policy page: one or two icon-and-paragraph
 * rows carrying the caveats and the contact address.
 *
 * The source repeated the row markup inline and hand-wrote `mt-3` on every row
 * after the first; that spacing rule is expressed here by index instead, which
 * produces the same class strings for both the one-row (terms) and two-row
 * (shipping, returns, privacy, cookies) cases.
 *
 * `text` is the key: each note in a panel is a distinct sentence.
 */
export function PolicyNotes({ notes }: { notes: readonly PolicyNote[] }) {
  return (
    <section className="max-w-4xl mx-auto mt-6 bg-green-50 border border-green-100 rounded-2xl p-5 md:p-6">
      {notes.map(({ Icon, text }, index) => (
        <div
          key={text}
          className={index === 0 ? "flex items-start gap-3" : "flex items-start gap-3 mt-3"}
        >
          <Icon className="w-5 h-5 text-[#3d7a3d] mt-0.5" />
          <p className="text-sm text-[#4f5f4f] leading-relaxed">{text}</p>
        </div>
      ))}
    </section>
  );
}
