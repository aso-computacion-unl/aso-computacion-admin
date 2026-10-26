import { describe, expect, it } from "vitest";

import { applyMarkdownTool } from "@/interface/forum/markdown-tools";

/** `[` and `]` in the fixture mark the selection, so cases read like what the student sees. */
function run(marked: string, tool: Parameters<typeof applyMarkdownTool>[3]) {
  const start = marked.indexOf("[");
  const end = marked.indexOf("]") - 1;
  const value = marked.replace("[", "").replace("]", "");
  const result = applyMarkdownTool(value, start, end, tool);

  return `${result.value.slice(0, result.selectionStart)}[${result.value.slice(result.selectionStart, result.selectionEnd)}]${result.value.slice(result.selectionEnd)}`;
}

describe("applyMarkdownTool", () => {
  it.each([
    ["bold", "Hola [mundo] feliz", "Hola **[mundo]** feliz"],
    ["bold", "Hola [] feliz", "Hola **[texto]** feliz"],
    ["italic", "Hola [mundo]", "Hola *[mundo]*"],
    ["italic", "[]", "*[texto]*"],
  ] as const)("%s wraps the selection or inserts a selected placeholder (%s)", (tool, input, expected) => {
    expect(run(input, tool)).toBe(expected);
  });

  it.each([
    ["Una línea\n[x = 1]", "Una línea\n```\n[x = 1]\n```"],
    ["Texto[ ]", "Texto\n```\n[ ]\n```"],
    ["[]", "```\n[]\n```"],
    ["[a]\nsigue", "```\n[a]\n```\nsigue"],
  ])("fence puts the selection in a fenced block on its own lines (%j)", (input, expected) => {
    expect(run(input, "fence")).toBe(expected);
  });

  it("fence on an empty selection leaves the caret inside the block", () => {
    const result = applyMarkdownTool("", 0, 0, "fence");

    expect(result.value).toBe("```\n\n```");
    expect(result.selectionStart).toBe(4);
    expect(result.selectionEnd).toBe(4);
  });

  it.each([
    ["uno\n[dos]\ntres", "uno\n[- dos]\ntres"],
    ["[uno\ndos]", "[- uno\n- dos]"],
    ["[- ya\ndos]", "[- ya\n- dos]"],
    ["alfa [be]ta", "[- alfa beta]"],
  ])("list prefixes every touched line once (%j)", (input, expected) => {
    expect(run(input, "list")).toBe(expected);
  });

  it("link wraps the selection and selects the address to type", () => {
    const result = applyMarkdownTool("Vea la guía", 4, 11, "link");

    expect(result.value).toBe("Vea [la guía](https://)");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("https://");
  });

  it("link turns a selected https address into the target and selects the label to type", () => {
    const result = applyMarkdownTool("https://example.org", 0, 19, "link");

    expect(result.value).toBe("[texto](https://example.org)");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("texto");
  });

  it("link with nothing selected inserts a placeholder label", () => {
    const result = applyMarkdownTool("", 0, 0, "link");

    expect(result.value).toBe("[texto](https://)");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("https://");
  });
});
