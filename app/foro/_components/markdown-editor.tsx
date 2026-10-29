"use client";

import { useLayoutEffect, useRef } from "react";

import { Icon, type IconName } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { applyMarkdownTool, type MarkdownTool } from "@/interface/forum/markdown-tools";

const TOOLS: { tool: MarkdownTool; label: string; icon: IconName }[] = [
  { tool: "bold", label: "Negrita", icon: "bold" },
  { tool: "italic", label: "Cursiva", icon: "italic" },
  { tool: "code", label: "Código en línea", icon: "code" },
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
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  // The new value is in the DOM once React commits it: restore focus and the selection before the browser
  // paints, so the very next keystroke already lands inside the inserted markup.
  useLayoutEffect(() => {
    const element = textarea.current;
    const selection = pendingSelection.current;
    if (!element || !selection) return;

    pendingSelection.current = null;
    element.focus();
    element.setSelectionRange(selection.start, selection.end);
  }, [value]);

  function apply(tool: MarkdownTool) {
    const element = textarea.current;
    if (!element) return;

    const edit = applyMarkdownTool(element.value, element.selectionStart, element.selectionEnd, tool);

    pendingSelection.current = { start: edit.selectionStart, end: edit.selectionEnd };
    onChange(edit.value);
  }

  return (
    <div className="grid gap-1.5">
      <div role="toolbar" aria-label="Formato Markdown" className="flex flex-wrap gap-0.5">
        {TOOLS.map(({ tool, label, icon }) => (
          <Button key={tool} variant="quiet" size="icon" aria-label={label}
            title={label}
            // A pointer press keeps the focus in the textarea; the keyboard path is restored by the effect above.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => apply(tool)}
          >
            <Icon name={icon} />
          </Button>
        ))}
      </div>
      <Textarea ref={textarea} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="font-mono text-[0.9rem] leading-[1.6]" {...field} />
    </div>
  );
}
