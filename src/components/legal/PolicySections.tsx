import type { PolicySection } from "./types";

/**
 * The stack of white cards on the five policy pages.
 *
 * Note the class list differs from the FAQ list on purpose — the policy pages
 * use `gap-4 md:gap-5` and an `<h2>` fixed at `text-lg`, where FAQ uses a flat
 * `gap-4` and a responsive `text-base md:text-lg` heading. They were written
 * separately in the SPA and are kept separate here rather than homogenised.
 *
 * `title` is the key because it is the visible heading and is unique within
 * every one of these lists.
 */
export function PolicySections({ sections }: { sections: readonly PolicySection[] }) {
  return (
    <section className="grid gap-4 md:gap-5 max-w-4xl mx-auto">
      {sections.map((section) => (
        <article
          key={section.title}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6"
        >
          <h2 className="text-lg font-semibold text-[#2d3a2d] mb-2">{section.title}</h2>
          <p className="text-sm md:text-base text-[#5f6d5f] leading-relaxed">
            {section.content}
          </p>
        </article>
      ))}
    </section>
  );
}
