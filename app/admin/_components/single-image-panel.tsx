"use client";

import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/interface/admin/action-result";

import { FieldError } from "./form-parts";
import { Panel } from "./page-head";
import { DeleteButton } from "./row-actions";
import { useRunAction } from "./use-run-action";

export interface StoredImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

interface SingleImagePanelProps {
  heading: string;
  /** Who the image belongs to, for the remove button's accessible name: "este pilar". */
  subject: string;
  image: StoredImage | null;
  /** The name of the alt field the server action reads (`imageAlt` for pillars, `photoAlt` for the board). */
  altField: string;
  upload: (formData: FormData) => Promise<ActionResult>;
  remove: () => Promise<ActionResult>;
  copy: {
    empty: string;
    add: string;
    replace: string;
    altLabel: string;
    removeTrigger: string;
    removeWarning: string;
    removeNote: string;
    rules: string;
    saved: string;
    uploading: string;
    submitAdd: string;
    submitReplace: string;
  };
}

/** One image per record: shows it, removes it with a confirmation, replaces or adds it with a description. */
export function SingleImagePanel({ heading, subject, image, altField, upload, remove, copy }: SingleImagePanelProps) {
  const id = useId();
  const run = useRunAction();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  // Bumping the key remounts the file input, the only way to clear it.
  const [inputKey, setInputKey] = useState(0);
  const errors = run.result?.fieldErrors ?? {};

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (run.pending || !file) return;

    const formData = new FormData();
    formData.set("file", file);
    formData.set(altField, alt);
    run.run(() => upload(formData), () => {
      setFile(null);
      setAlt("");
      setInputKey((key) => key + 1);
    });
  }

  return (
    <Panel aria-labelledby={`${id}-heading`} className="grid gap-5">
      <h2 id={`${id}-heading`} className="text-lg font-bold font-stretch-[112%]">
        {heading}
      </h2>

      {image ? (
        <div className="grid justify-items-start gap-3">
          {/* Remote Cloudinary asset shown as-is in the admin; no image optimisation needed. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={image.alt} width={320} height={Math.round((320 * image.height) / image.width)} className="max-h-72 w-full max-w-xs rounded-xs object-cover" />
          <DeleteButton
            label={subject}
            warning={copy.removeWarning}
            note={copy.removeNote}
            triggerLabel={copy.removeTrigger}
            triggerClassName="-ml-3"
            compactOnMobile={false}
            confirmLabel="Sí, quitar"
            action={remove}
          />
        </div>
      ) : (
        <p role="status" className="text-mist">
          {copy.empty}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="grid gap-4 border-t border-border pt-5">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-file`}>
            {image ? copy.replace : copy.add}
          </Label>
          <input
            key={inputKey}
            id={`${id}-file`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            aria-invalid={errors.file ? true : undefined}
            aria-describedby={`${id}-rules${errors.file ? ` ${id}-file-error` : ""}`}
            className="w-full min-w-0 rounded border border-input bg-muted p-2 text-sm text-mist"
          />
          <small id={`${id}-rules`} className="text-[0.8125rem] leading-[1.4] text-mist">
            {copy.rules}
          </small>
          {errors.file ? <FieldError id={`${id}-file-error`}>{errors.file}</FieldError> : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-alt`}>{copy.altLabel}</Label>
          <Input
            id={`${id}-alt`}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            maxLength={200}
            required
            aria-invalid={errors[altField] ? true : undefined}
            aria-describedby={errors[altField] ? `${id}-alt-error` : undefined}
          />
          <small className="text-[0.8125rem] leading-[1.4] text-mist">Obligatoria, para quien no pueda ver la imagen.</small>
          {errors[altField] ? <FieldError id={`${id}-alt-error`}>{errors[altField]}</FieldError> : null}
        </div>
        <div aria-live="polite" className="text-sm">
          {run.result?.error ? <FieldError>{run.result.error}</FieldError> : null}
          {run.result?.success ? (
            <p role="status" className="font-semibold text-sky">
              {copy.saved}
            </p>
          ) : null}
        </div>
        <Button type="submit" busy={run.pending} aria-disabled={run.pending || !file || undefined} className="justify-self-start">
          {run.pending ? copy.uploading : image ? copy.submitReplace : copy.submitAdd}
        </Button>
      </form>
    </Panel>
  );
}
