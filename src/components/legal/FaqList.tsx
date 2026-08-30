import type { FaqEntry } from "./types";

/**
 * The FAQ question-and-answer list.
 *
 * Separate from `PolicySections` because the source's markup genuinely differs:
 * the grid is `gap-4` with no `md:` step, the container classes are ordered
 * differently, and the heading is `text-base md:text-lg` rather than a flat
 * `text-lg`. Folding the two together would change the rendering of one of them.
 *
 * Nothing collapses — the SPA rendered every answer open, so there is no
 * accordion to port and no client JavaScript on this route.
 */
export function FaqList({ entries }: { entries: readonly FaqEntry[] }) {
  return (
    <section className="max-w-4xl mx-auto grid gap-4">
      {entries.map((item) => (
        <article
          key={item.question}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6"
        >
          <h2 className="text-base md:text-lg font-semibold text-[#2d3a2d] mb-2">
            {item.question}
          </h2>
          <p className="text-sm md:text-base text-[#5f6d5f] leading-relaxed">
            {item.answer}
          </p>
        </article>
      ))}
    </section>
  );
}

/**
 * FAQ's closing green panel — a bare paragraph, where the policy pages put an
 * icon beside each line. Kept distinct for the same reason as the list above.
 */
export function FaqFootnote({ text }: { text: string }) {
  return (
    <section className="max-w-4xl mx-auto mt-6 bg-green-50 border border-green-100 rounded-2xl p-5 md:p-6">
      <p className="text-sm text-[#4f5f4f] leading-relaxed">{text}</p>
    </section>
  );
}
