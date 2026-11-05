"use client";

import { useId, useState, type ReactNode } from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function formatFileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

interface MediaDropzoneProps {
  /** The action in words: "Elegir fotos". */
  title: string;
  /** The rules the server enforces, shown early: formats, size, minimum width. */
  rules: ReactNode;
  accept: readonly string[];
  multiple?: boolean;
  disabled?: boolean;
  /** Bumping it remounts the input, the only way to clear a picked file. */
  inputKey?: string | number;
  /** The input's accessible name. */
  ariaLabel: string;
  /** Id of a message about the pick (an error), read together with the rules. */
  describedBy?: string;
  invalid?: boolean;
  /** For one file: the one already picked, shown in place of the title. */
  chosen?: { name: string; size: string };
  onFiles: (files: File[]) => void;
}

/**
 * The one way to pick images in the admin: a dashed drop zone whose invisible file input covers it, so a click, a tap and
 * a drag from the desktop all work and the browser's own "Choose File" is never seen. It only picks; each screen decides
 * what to do with the files.
 */
export function MediaDropzone({ title, rules, accept, multiple = false, disabled = false, inputKey, ariaLabel, describedBy, invalid, chosen, onFiles }: MediaDropzoneProps) {
  const rulesId = useId();
  // The invisible input covers the zone, so it receives the drag events: leaving it means leaving the zone.
  const [dragging, setDragging] = useState(false);
  const drag = (over: boolean) => () => setDragging(over && !disabled);

  return (
    <label
      data-slot="media-dropzone"
      data-dragging={dragging || undefined}
      onDragEnter={drag(true)}
      onDragOver={drag(true)}
      onDragLeave={drag(false)}
      onDrop={drag(false)}
      className={cn(
        "relative grid cursor-pointer justify-items-center gap-1.5 rounded border-2 border-dashed border-foreground/45 bg-muted/55 px-4 py-5 text-center",
        "transition-colors duration-150 ease-out hover:border-action hover:bg-foreground/8 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-sky",
        "data-[dragging=true]:border-solid data-[dragging=true]:border-action data-[dragging=true]:bg-action/15",
        invalid && "border-error/70",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <Icon name={chosen ? "check" : "upload"} className="size-7" />
      {chosen ? (
        <span className="max-w-full">
          <strong className="block truncate font-bold font-stretch-[112%]">{chosen.name}</strong>
          <span className="font-mono text-xs text-mist">{chosen.size} · elija otra</span>
        </span>
      ) : (
        <span>
          <strong className="font-bold font-stretch-[112%]">{title}</strong>
          <span className="hidden md:inline"> {multiple ? "o arrastrarlas aquí" : "o arrastrarla aquí"}</span>
        </span>
      )}
      <span id={rulesId} className="text-xs leading-snug text-mist">
        {rules}
      </span>
      <input
        key={inputKey}
        type="file"
        multiple={multiple}
        accept={accept.join(",")}
        disabled={disabled}
        onChange={(event) => onFiles(Array.from(event.target.files ?? []))}
        aria-label={ariaLabel}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={[rulesId, describedBy].filter(Boolean).join(" ")}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}
