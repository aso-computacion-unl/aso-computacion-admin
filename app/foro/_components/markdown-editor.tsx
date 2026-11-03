"use client";

import { useRef } from "react";

import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { applyMarkdownTool, type MarkdownTool } from "@/interface/forum/markdown-tools";

const TOOLS: { tool: MarkdownTool; label: string; icon: IconName }[] = [
  { tool: "bold", label: "Negrita", icon: "bold" },
  { tool: "italic", label: "Cursiva", icon: "italic" },
  { tool: "fence", label: "Bloque de código", icon: "terminal" },
  { tool: "list", label: "Lista", icon: "list" },
  { tool: "link", label: "Enlace", icon: "link" },
];

interface MarkdownEditorProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength: number;
  placeholder?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

/** A textarea with the formatting buttons above it. The buttons edit the text and keep the selection. */
export function MarkdownEditor({ value, onChange, rows = 8, ...field }: MarkdownEditorProps) {
  const textarea = useRef<HTMLTextAreaElement>(null);

  function apply(tool: MarkdownTool) {
    const element = textarea.current;
    if (!element) return;

    const edit = applyMarkdownTool(element.value, element.selectionStart, element.selectionEnd, tool);

    onChange(edit.value);
    // The new value reaches the DOM after this handler; put the caret back once it has.
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    });
  }

  return (
    <div className="grid gap-1.5">
      <div role="toolbar" aria-label="Formato Markdown" className="flex flex-wrap gap-0.5">
        {TOOLS.map(({ tool, label, icon }) => (
          <Button key={tool} variant="quiet" size="icon" aria-label={label} title={label} onClick={() => apply(tool)}>
            <Icon name={icon} />
          </Button>
        ))}
      </div>
      <Textarea ref={textarea} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="font-mono text-[0.9rem] leading-[1.6]" {...field} />
    </div>
  );
}
