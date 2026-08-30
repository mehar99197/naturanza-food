import { parseInline } from "./inline";
import { headingId } from "./toc";
import type { BlockNode, HeadingDepth, InlineNode, ListItem } from "./types";

/**
 * Block-level markdown: headings, paragraphs, lists, quotes, rules, fenced code
 * and GFM tables.
 *
 * Line-oriented rather than a full CommonMark scanner — see ./types for the
 * reasoning. Constructs the blog does not use (setext headings, reference links,
 * indented code blocks, HTML blocks) are not recognised and fall through to
 * paragraph text.
 */

const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const THEMATIC_BREAK = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const BLOCKQUOTE = /^ {0,3}> ?/;
const BULLET_ITEM = /^( {0,3})[-*+]([ \t]+)(.*)$/;
const ORDERED_ITEM = /^( {0,3})(\d{1,9})[.)]([ \t]+)(.*)$/;
const TABLE_DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

const leadingSpaces = (line: string): number => (/^[ \t]*/.exec(line)?.[0] ?? "").length;

interface Marker {
  ordered: boolean;
  /** Column at which the item's own content starts, used to dedent its body. */
  contentIndent: number;
  content: string;
}

/**
 * Recognises a list item marker.
 *
 * Thematic breaks are excluded first: `* * *` and `- - -` both satisfy the
 * bullet pattern, and reading them as one-item lists would swallow the rule.
 */
const matchMarker = (line: string): Marker | null => {
  if (THEMATIC_BREAK.test(line)) return null;

  const bullet = BULLET_ITEM.exec(line);
  if (bullet) {
    const indent = bullet[1] ?? "";
    const spaces = bullet[2] ?? " ";
    return {
      ordered: false,
      contentIndent: indent.length + 1 + spaces.length,
      content: bullet[3] ?? "",
    };
  }

  const ordered = ORDERED_ITEM.exec(line);
  if (ordered) {
    const indent = ordered[1] ?? "";
    const digits = ordered[2] ?? "1";
    const spaces = ordered[3] ?? " ";
    return {
      ordered: true,
      contentIndent: indent.length + digits.length + 1 + spaces.length,
      content: ordered[4] ?? "",
    };
  }

  return null;
};

/** Whether a line would begin a block, and so end an open paragraph. */
const startsBlock = (line: string): boolean =>
  ATX_HEADING.test(line) ||
  FENCE.test(line) ||
  THEMATIC_BREAK.test(line) ||
  BLOCKQUOTE.test(line) ||
  matchMarker(line) !== null;

/** Splits a table row on its unescaped pipes, dropping the outer ones. */
const splitRow = (line: string): string[] => {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "";
  let index = 0;

  while (index < body.length) {
    const char = body[index] as string;
    if (char === "\\" && body[index + 1] === "|") {
      cell += "|";
      index += 2;
      continue;
    }
    if (char === "|") {
      cells.push(cell.trim());
      cell = "";
      index += 1;
      continue;
    }
    cell += char;
    index += 1;
  }

  cells.push(cell.trim());
  return cells;
};

const toCells = (line: string): InlineNode[][] => splitRow(line).map(parseInline);

/** Collects one list and everything nested inside it. */
const readList = (
  lines: string[],
  from: number,
): { node: BlockNode; next: number } => {
  const ordered = matchMarker(lines[from] ?? "")?.ordered ?? false;
  const bodies: string[][] = [];
  let loose = false;
  let blankSeen = false;
  let index = from;

  while (index < lines.length) {
    const marker = matchMarker(lines[index] ?? "");
    if (!marker || marker.ordered !== ordered) break;

    // A blank line between two items is what makes the whole list loose.
    if (bodies.length > 0 && blankSeen) loose = true;
    blankSeen = false;

    const body = [marker.content];
    bodies.push(body);
    index += 1;

    while (index < lines.length) {
      const line = lines[index] ?? "";

      if (!line.trim()) {
        blankSeen = true;
        index += 1;
        continue;
      }

      // Indentation is checked before the marker pattern, so that an indented
      // `- nested` is taken as this item's content rather than as a sibling.
      if (leadingSpaces(line) >= marker.contentIndent) {
        if (blankSeen) {
          body.push("");
          loose = true;
          blankSeen = false;
        }
        body.push(line.slice(marker.contentIndent));
        index += 1;
        continue;
      }

      if (matchMarker(line)) break;
      // After a blank line, unindented text has left the list entirely.
      if (blankSeen || startsBlock(line)) break;

      body.push(line.trim());
      index += 1;
    }
  }

  const items: ListItem[] = bodies.map((body) => ({ children: parseBlocks(body.join("\n")) }));

  return { node: { type: "list", ordered, loose, items }, next: index };
};

export function parseBlocks(source: string): BlockNode[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: BlockNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence?.[1]) {
      const marker = fence[1];
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !new RegExp(`^ {0,3}${marker[0]}{${marker.length},}[ \t]*$`).test(lines[index] ?? "")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      blocks.push({ type: "code", value: code.join("\n") });
      continue;
    }

    if (THEMATIC_BREAK.test(line)) {
      blocks.push({ type: "thematicBreak" });
      index += 1;
      continue;
    }

    const heading = ATX_HEADING.exec(line);
    if (heading?.[1]) {
      const depth = heading[1].length as HeadingDepth;
      // A closing run of hashes is decoration, not content.
      const text = (heading[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim();
      blocks.push({
        type: "heading",
        depth,
        id: depth <= 3 ? headingId(text) : null,
        children: parseInline(text),
      });
      index += 1;
      continue;
    }

    if (BLOCKQUOTE.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length) {
        const current = lines[index] ?? "";
        if (BLOCKQUOTE.test(current)) {
          quoted.push(current.replace(BLOCKQUOTE, ""));
          index += 1;
          continue;
        }
        // Lazy continuation: an unmarked line still belongs to the quote's
        // paragraph, but a blank line or a new block ends the quote.
        if (!current.trim() || startsBlock(current)) break;
        quoted.push(current);
        index += 1;
      }
      blocks.push({ type: "blockquote", children: parseBlocks(quoted.join("\n")) });
      continue;
    }

    if (matchMarker(line)) {
      const list = readList(lines, index);
      blocks.push(list.node);
      index = list.next;
      continue;
    }

    const delimiter = lines[index + 1];
    if (
      line.includes("|") &&
      delimiter !== undefined &&
      TABLE_DELIMITER.test(delimiter) &&
      splitRow(delimiter).length === splitRow(line).length
    ) {
      const header = toCells(line);
      const rows: InlineNode[][][] = [];
      index += 2;
      while (index < lines.length) {
        const row = lines[index] ?? "";
        if (!row.trim() || !row.includes("|")) break;
        rows.push(toCells(row));
        index += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (!current.trim() || startsBlock(current)) break;
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
  }

  return blocks;
}
