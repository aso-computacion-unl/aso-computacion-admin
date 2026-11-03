import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownBody } from "../../../../app/foro/_components/markdown-body";

const render = (source: string) => renderToStaticMarkup(createElement(MarkdownBody, { source }));

describe("a forum post body", () => {
  it("renders paragraphs, bold, italic and lists", () => {
    const html = render("Hola **mundo** y *todos*\n\n- uno\n- dos");

    expect(html).toContain("<p>Hola <strong>mundo</strong> y <em>todos</em></p>");
    expect(html).toContain("<li>uno</li>");
    expect(html).toContain("<li>dos</li>");
  });

  it("renders a fenced block verbatim in a focusable, scrollable pre", () => {
    const html = render("Mire:\n\n```c\nfree(nodo);\n\nnodo = nodo->siguiente;\n```");

    expect(html).toContain('<pre tabindex="0"');
    expect(html).toContain('data-language="c"');
    expect(html).toContain("free(nodo);\n\nnodo = nodo-&gt;siguiente;");
  });

  it("renders inline code as code, without the backticks, and keeps HTML inside it as text", () => {
    const html = render("Revise los `free` y `<b>`");

    expect(html).toContain("Revise los <code");
    expect(html).toContain(">free</code>");
    expect(html).toContain(">&lt;b&gt;</code>");
    expect(html).not.toContain("`");
  });

  it("never lets a student's HTML through: it stays text", () => {
    const html = render('<script>alert(1)</script> <img src=x onerror="alert(2)">\n\n```\n<b>no</b>\n```');

    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;b&gt;no&lt;/b&gt;");
  });

  it("opens an https link in a new tab without opener or ranking, and shows only the label of any other scheme", () => {
    const html = render("[docs](https://example.org/a) y [mala](javascript:alert(1))");

    expect(html).toContain('href="https://example.org/a"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow ugc"');
    expect(html).not.toContain("javascript:");
    expect(html).toContain("mala");
  });

  it("renders nothing visible for an empty body", () => {
    expect(render("")).not.toContain("<p>");
  });
});
