import Link from "next/link";
import type { ReactNode } from "react";

import { parseBlocks } from "./blocks";
import type { BlockNode, InlineNode, ListItem } from "./types";

/**
 * Renders a post body on the server.
 *
 * Every class name below is copied from the `components` map the Vite page handed
 * to react-markdown, so the article looks identical — the change is only that the
 * browser now receives the finished markup instead of the library that produced
 * it. This is a Server Component and stays one: it holds no state and imports
 * nothing that does.
 *
 * Element types not in the original's map (`pre`, `tbody`, `tr`, `del`, `img`,
 * `br`) were rendered by react-markdown with no class, and are unstyled here too.
 */

const LINK_CLASS = "text-green-700 font-semibold underline underline-offset-2 hover:text-green-800";

const HEADING_CLASS = {
  1: "scroll-mt-24 text-2xl sm:text-3xl font-bold text-gray-900 mt-8 mb-4",
  2: "scroll-mt-24 text-xl sm:text-2xl font-bold text-gray-900 mt-7 mb-3",
  3: "scroll-mt-24 text-lg font-semibold text-gray-900 mt-5 mb-2",
} as const;

function renderInline(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (node.type) {
      case "text":
        return node.value;

      case "strong":
        return (
          <strong key={key} className="font-bold text-gray-900">
            {renderInline(node.children, key)}
          </strong>
        );

      case "emphasis":
        return (
          <em key={key} className="italic">
            {renderInline(node.children, key)}
          </em>
        );

      case "delete":
        return <del key={key}>{renderInline(node.children, key)}</del>;

      case "inlineCode":
        return (
          <code key={key} className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-gray-800">
            {node.value}
          </code>
        );

      case "link": {
        const children = renderInline(node.children, key);
        // Internal destinations go through next/link so an in-article link is a
        // client-side navigation, exactly as the react-router <Link> was. Both
        // render a plain <a> with the same class, so the markup is unchanged.
        return node.href.startsWith("/") ? (
          <Link key={key} href={node.href} className={LINK_CLASS}>
            {children}
          </Link>
        ) : (
          <a key={key} href={node.href || "#"} className={LINK_CLASS}>
            {children}
          </a>
        );
      }

      case "image":
        // eslint-disable-next-line @next/next/no-img-element -- matches the
        // plain <img> react-markdown emitted; dimensions are unknown here.
        return <img key={key} src={node.src} alt={node.alt} />;

      case "break":
        return <br key={key} />;
    }
  });
}

/**
 * In a tight list the item's paragraphs are unwrapped, so the text sits directly
 * inside the <li> — the same output react-markdown produced, and the reason a
 * blank line between items visibly loosens their spacing.
 */
function renderListItem(item: ListItem, loose: boolean, key: string): ReactNode {
  const children = loose
    ? renderBlocks(item.children, key)
    : item.children.map((child, index) =>
        child.type === "paragraph"
          ? renderInline(child.children, `${key}-${index}`)
          : renderBlock(child, `${key}-${index}`),
      );

  return (
    <li key={key} className="leading-7">
      {children}
    </li>
  );
}

function renderBlock(node: BlockNode, key: string): ReactNode {
  switch (node.type) {
    case "heading": {
      const children = renderInline(node.children, key);
      // Depth shifts down by one: the page's own <h1> is the post title, so the
      // body's top-level heading has to be an <h2> for the outline to hold.
      if (node.depth === 1) {
        return (
          <h2 key={key} id={node.id ?? undefined} className={HEADING_CLASS[1]}>
            {children}
          </h2>
        );
      }
      if (node.depth === 2) {
        return (
          <h3 key={key} id={node.id ?? undefined} className={HEADING_CLASS[2]}>
            {children}
          </h3>
        );
      }
      if (node.depth === 3) {
        return (
          <h4 key={key} id={node.id ?? undefined} className={HEADING_CLASS[3]}>
            {children}
          </h4>
        );
      }
      if (node.depth === 4) return <h4 key={key}>{children}</h4>;
      if (node.depth === 5) return <h5 key={key}>{children}</h5>;
      return <h6 key={key}>{children}</h6>;
    }

    case "paragraph":
      return (
        <p key={key} className="text-[15px] leading-7 text-gray-700 mb-4">
          {renderInline(node.children, key)}
        </p>
      );

    case "list": {
      const items = node.items.map((item, index) =>
        renderListItem(item, node.loose, `${key}-${index}`),
      );
      return node.ordered ? (
        <ol key={key} className="list-decimal pl-6 mb-4 space-y-1.5 text-gray-700">
          {items}
        </ol>
      ) : (
        <ul key={key} className="list-disc pl-6 mb-4 space-y-1.5 text-gray-700">
          {items}
        </ul>
      );
    }

    case "blockquote":
      return (
        <blockquote
          key={key}
          className="border-l-4 border-green-400 bg-green-50/60 px-4 py-2 my-4 rounded-r-lg text-gray-700 italic"
        >
          {renderBlocks(node.children, key)}
        </blockquote>
      );

    case "code":
      return (
        <pre key={key}>
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-gray-800">
            {node.value}
          </code>
        </pre>
      );

    case "table":
      return (
        <div key={key} className="my-5 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-green-50 text-gray-800">
              <tr>
                {node.header.map((cell, cellIndex) => (
                  <th
                    key={`${key}-h-${cellIndex}`}
                    className="px-4 py-2.5 text-left font-semibold border-b border-gray-200"
                  >
                    {renderInline(cell, `${key}-h-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {node.rows.map((row, rowIndex) => (
                <tr key={`${key}-r-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${key}-r-${rowIndex}-${cellIndex}`}
                      className="px-4 py-2.5 border-b border-gray-100 text-gray-700 align-top"
                    >
                      {renderInline(cell, `${key}-r-${rowIndex}-${cellIndex}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "thematicBreak":
      return <hr key={key} className="my-8 border-gray-200" />;
  }
}

function renderBlocks(nodes: BlockNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => renderBlock(node, `${keyPrefix}-${index}`));
}

export function MarkdownContent({ source }: { source: string | null | undefined }) {
  if (!source) return null;

  return <>{renderBlocks(parseBlocks(source), "md")}</>;
}
