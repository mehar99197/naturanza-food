import { readLink, safeHref } from "./links";
import type { InlineNode } from "./types";

/**
 * Inline markdown: emphasis, code spans, links, images, strikethrough.
 *
 * A pragmatic subset rather than a CommonMark implementation. It covers what the
 * blog is written in and resolves the ambiguous cases the way the old
 * react-markdown pipeline did; see ./types for why a full parser is not the goal.
 */

const ESCAPABLE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

/**
 * A run of the same delimiter character starting at `index`.
 *
 * Length decides meaning — one asterisk is emphasis, two are strong — so the run
 * has to be measured before anything is consumed.
 */
const runLength = (source: string, index: number, char: string): number => {
  let length = 0;
  while (source[index + length] === char) length += 1;
  return length;
};

const isWhitespace = (char: string | undefined): boolean =>
  char === undefined || /\s/.test(char);

const isWordCharacter = (char: string | undefined): boolean =>
  char !== undefined && /[A-Za-z0-9]/.test(char);

/**
 * A real HTML tag, which is dropped rather than rendered.
 *
 * react-markdown ignores raw HTML unless `rehype-raw` is added, and it was not,
 * so dropping matches the page being replaced *and* is the safe default. The
 * pattern insists on a tag name so that prose like "5 < 10 and 20 > 3" survives
 * as text instead of losing the span between the angle brackets.
 */
const HTML_TAG = /^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*?)?\/?>/;

/** Finds the delimiter run that closes an emphasis span opened at `from`. */
const findClosingRun = (
  source: string,
  from: number,
  char: string,
  minimum: number,
): { index: number; length: number } | null => {
  for (let index = from; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] !== char) continue;

    const length = runLength(source, index, char);
    // A closer cannot follow whitespace ("a * b" is not emphasis), and an
    // underscore cannot close inside a word, which is what keeps snake_case
    // identifiers intact.
    if (length < minimum) {
      index += length - 1;
      continue;
    }
    if (isWhitespace(source[index - 1])) {
      index += length - 1;
      continue;
    }
    if (char === "_" && isWordCharacter(source[index + length])) {
      index += length - 1;
      continue;
    }
    return { index, length };
  }

  return null;
};

/** Flattens a tree to its text, for an image's `alt` attribute. */
export const inlineText = (nodes: InlineNode[]): string =>
  nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "inlineCode":
          return node.value;
        case "strong":
        case "emphasis":
        case "delete":
        case "link":
          return inlineText(node.children);
        case "image":
          return node.alt;
        case "break":
          return " ";
      }
    })
    .join("");

export function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = "";
  let index = 0;

  const flush = (): void => {
    if (buffer) {
      nodes.push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  while (index < source.length) {
    const char = source[index] as string;

    // Two trailing spaces before a newline is markdown's hard line break;
    // a plain newline is a soft break and stays whitespace.
    if (char === "\n") {
      if (/ {2,}$/.test(buffer)) {
        buffer = buffer.replace(/ +$/, "");
        flush();
        nodes.push({ type: "break" });
      } else {
        buffer += "\n";
      }
      index += 1;
      continue;
    }

    if (char === "\\") {
      const next = source[index + 1];
      if (next && ESCAPABLE.test(next)) {
        buffer += next;
        index += 2;
        continue;
      }
      buffer += char;
      index += 1;
      continue;
    }

    if (char === "`") {
      const fenceLength = runLength(source, index, "`");
      const fence = "`".repeat(fenceLength);
      const close = source.indexOf(fence, index + fenceLength);
      if (close !== -1) {
        flush();
        const value = source.slice(index + fenceLength, close);
        // One space of padding on both sides is stripping the fence, not content.
        nodes.push({
          type: "inlineCode",
          value: /^ .* $/s.test(value) ? value.slice(1, -1) : value,
        });
        index = close + fenceLength;
        continue;
      }
      buffer += fence;
      index += fenceLength;
      continue;
    }

    if (char === "<") {
      const tag = HTML_TAG.exec(source.slice(index));
      if (tag?.[0]) {
        index += tag[0].length;
        continue;
      }
      buffer += char;
      index += 1;
      continue;
    }

    if (char === "!" && source[index + 1] === "[") {
      const image = readLink(source, index + 1);
      if (image) {
        flush();
        nodes.push({
          type: "image",
          src: safeHref(image.href),
          alt: inlineText(parseInline(image.label)),
        });
        index = image.end;
        continue;
      }
    }

    if (char === "[") {
      const link = readLink(source, index);
      if (link) {
        flush();
        nodes.push({
          type: "link",
          href: safeHref(link.href),
          children: parseInline(link.label),
        });
        index = link.end;
        continue;
      }
    }

    if (char === "~" && source[index + 1] === "~") {
      const close = findClosingRun(source, index + 2, "~", 2);
      if (close) {
        flush();
        nodes.push({ type: "delete", children: parseInline(source.slice(index + 2, close.index)) });
        index = close.index + 2;
        continue;
      }
    }

    if (char === "*" || char === "_") {
      const openLength = runLength(source, index, char);
      const opensSpan =
        !isWhitespace(source[index + openLength]) &&
        !(char === "_" && isWordCharacter(source[index - 1]));

      if (opensSpan) {
        const take = Math.min(openLength, 2);
        const close = findClosingRun(source, index + openLength, char, take);
        if (close) {
          flush();
          const inner = parseInline(source.slice(index + openLength, close.index));
          // Three or more delimiters is strong nested inside emphasis, which is
          // the nesting order CommonMark specifies.
          nodes.push(
            openLength >= 3
              ? { type: "emphasis", children: [{ type: "strong", children: inner }] }
              : { type: take === 2 ? "strong" : "emphasis", children: inner },
          );
          index = close.index + Math.min(close.length, openLength);
          continue;
        }
      }
    }

    buffer += char;
    index += 1;
  }

  flush();
  return nodes;
}
