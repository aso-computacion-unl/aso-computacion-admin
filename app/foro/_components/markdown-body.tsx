import type { ReactNode } from "react";

import { parseMarkdownSubset, type InlineNode } from "@/interface/admin/markdown-subset";

function renderInline(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return node.text;
      case "code":
        return (
          <code key={index} className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[0.85em]">
            {node.text}
          </code>
        );
      case "strong":
        return <strong key={index}>{renderInline(node.children)}</strong>;
      case "em":
        return <em key={index}>{renderInline(node.children)}</em>;
      case "link":
        // Student-written links: https only (the parser drops the rest), never followed for ranking, no opener.
        return (
          <a key={index} href={node.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-sky-bright underline underline-offset-4 hover:decoration-2">
            {renderInline(node.children)}
          </a>
        );
    }
  });
}

/**
 * A post body: the Markdown subset with fenced code, built as React elements. There is no HTML anywhere in
 * the path, so a student's `<script>` is only text. The same component draws the composer's preview.
 */
export function MarkdownBody({ source }: { source: string }) {
  const blocks = parseMarkdownSubset(source, { codeBlocks: true });

  return (
    <div className="grid gap-3.5 leading-[1.65] wrap-anywhere">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return <p key={index}>{renderInline(block.children)}</p>;
          case "list":
            return (
              <ul key={index} className="grid list-disc gap-1 pl-5 marker:text-sky">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "code":
            // A focusable, labelled scroll region (WAI-ARIA and axe's scrollable-region-focusable): Safari does not
            // make scrollable areas keyboard-focusable on its own, so without tabIndex a keyboard user could not
            // scroll a long line sideways. Sonar's S6845 flags any tabIndex on a non-interactive role, which is a
            // false positive for a scroll region; a textbox role would make screen readers announce an edit field.
            return (
              <pre
                key={index}
                tabIndex={0} // NOSONAR typescript:S6845: focusable scroll region, see above
                role="region"
                aria-label="Código"
                data-language={block.language ?? undefined}
                className="overflow-x-auto rounded-lg border border-border bg-background p-3.5 font-mono text-[0.85rem] leading-[1.6] wrap-normal">
                <code>{block.text}</code>
              </pre>
            );
        }
      })}
    </div>
  );
}
