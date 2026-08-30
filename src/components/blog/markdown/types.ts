/**
 * The syntax tree the blog's markdown is parsed into before it becomes React.
 *
 * The Vite page rendered post bodies with `react-markdown` + `remark-gfm`, which
 * is why BlogPost was the heaviest route on the site: that pair is ~174 kB of
 * JavaScript shipped to every reader so the browser could turn text the server
 * already had into HTML the server could already have produced.
 *
 * Neither package is installed at the Next root, and adding them would keep the
 * cost while moving it. The subset of markdown the blog actually uses — headings,
 * paragraphs, lists, emphasis, links, blockquotes, rules, fenced code and GFM
 * tables — is small enough to parse here, on the server, and render straight to
 * React elements. Nothing about the body reaches the browser as JavaScript.
 *
 * Rendering to elements rather than to an HTML string is also what makes this
 * safe. There is no `dangerouslySetInnerHTML` anywhere in the path: React escapes
 * every text node, and the element types and URL schemes are chosen here rather
 * than taken from the document. Post bodies are admin-authored, but they are
 * still stored data, and stored data that renders as markup is how stored XSS
 * happens.
 */

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "emphasis"; children: InlineNode[] }
  | { type: "delete"; children: InlineNode[] }
  | { type: "inlineCode"; value: string }
  | { type: "link"; href: string; children: InlineNode[] }
  | { type: "image"; src: string; alt: string }
  | { type: "break" };

/** ATX heading depth. Only 1–3 carry an anchor id; see ./toc. */
export type HeadingDepth = 1 | 2 | 3 | 4 | 5 | 6;

export interface ListItem {
  /** An item is a block container in its own right, so it can hold a nested list. */
  children: BlockNode[];
}

export type BlockNode =
  | {
      type: "heading";
      depth: HeadingDepth;
      /** Null for depth 4–6, which the original never gave an id. */
      id: string | null;
      children: InlineNode[];
    }
  | { type: "paragraph"; children: InlineNode[] }
  | {
      type: "list";
      ordered: boolean;
      /**
       * A loose list wraps each item's text in <p>, a tight one does not —
       * the distinction CommonMark draws on blank lines between items, and the
       * reason a stray blank line changes a list's spacing.
       */
      loose: boolean;
      items: ListItem[];
    }
  | { type: "blockquote"; children: BlockNode[] }
  // No `lang`: the original's `code` renderer took only `children`, so a fenced
  // block's language never reached the DOM as a class. Same for an ordered
  // list's `start` above — its `ol` renderer dropped the attribute too.
  | { type: "code"; value: string }
  | { type: "table"; header: InlineNode[][]; rows: InlineNode[][][] }
  | { type: "thematicBreak" };
