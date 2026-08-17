/**
 * Heading anchors and the table of contents built from them.
 *
 * ⚠ These two things disagreed in the Vite page, and the disagreement was a bug.
 * `extractTOC` slugged the *raw source* of a heading line, while the `h1`/`h2`/`h3`
 * renderers slugged the *rendered children* — and react-markdown hands a renderer
 * an array in which every formatted span is an element, not a string, which the
 * old `toId` mapped to "". So `## What **makes** it special` produced the TOC
 * entry `what-makes-it-special` pointing at a heading whose id was `what-special`:
 * a contents link that scrolled nowhere.
 *
 * Both now derive from the raw source text through `headingId`. For a plain-text
 * heading — every heading in the seeded posts — the id is byte-identical to what
 * the old page emitted; for a formatted one the anchor now resolves instead of
 * dangling.
 */

export interface TocItem {
  /** 1–3. Deeper headings are not listed, matching the original. */
  level: number;
  text: string;
  id: string;
}

/**
 * The original slug algorithm, unchanged: lowercase, drop everything that is not
 * a letter, digit or space, then hyphenate runs of whitespace.
 *
 * Note it strips markdown punctuation as a side effect, so `**makes**` and
 * `makes` slug alike — which is exactly why using it on raw source works.
 */
export const headingId = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, "")
    .trim()
    .replace(/\s+/g, "-");

const TOC_HEADING = /^(#{1,3}) (.+)/;

/**
 * Scans the source for h1–h3 lines.
 *
 * Deliberately a line scan rather than a walk of the parsed tree, so that it
 * keeps the original's quirks: a `# …` line inside a fenced code block is listed,
 * and a heading indented by even one space is not.
 */
export const extractToc = (markdown: string | null | undefined): TocItem[] => {
  if (!markdown) return [];

  const items: TocItem[] = [];

  for (const line of markdown.split("\n")) {
    const match = TOC_HEADING.exec(line);
    if (!match) continue;

    const hashes = match[1];
    const rawText = match[2];
    if (!hashes || !rawText) continue;

    const text = rawText.trim();
    items.push({ level: hashes.length, text, id: headingId(text) });
  }

  return items;
};
