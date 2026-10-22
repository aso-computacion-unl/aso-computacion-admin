"use client";

import { useId, useState, type FormEvent } from "react";

import { MAX_ACTIVE_EVENT_PHOTOS } from "@/domain/event-photo";
import { uploadEventPhoto } from "@/interface/admin/events/actions";

import { useRunAction } from "./use-run-action";

interface PhotoUploadFormProps {
  eventId: string;
  activeCount: number;
}

export function PhotoUploadForm({ eventId, activeCount }: PhotoUploadFormProps) {
  const id = useId();
  const { pending, result, run } = useRunAction();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  // Bumping the key remounts the file input, the only way to clear it.
  const [inputKey, setInputKey] = useState(0);
  const full = activeCount >= MAX_ACTIVE_EVENT_PHOTOS;
  const errors = result?.fieldErrors ?? {};

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !file) return;

    const formData = new FormData();
    formData.set("file", file);
    formData.set("alt", alt);
    run(() => uploadEventPhoto(eventId, null, formData), () => {
      setFile(null);
      setAlt("");
      setInputKey((key) => key + 1);
    });
  }

  if (full) {
    return <p role="status">La galería tiene el máximo de {MAX_ACTIVE_EVENT_PHOTOS} fotos. Quite una para subir otra.</p>;
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="field">
        <label htmlFor={`${id}-file`}>Foto (JPEG, PNG o WebP, hasta 5 MB, mínimo 1200 px de ancho)</label>
        <input
          key={inputKey}
          id={`${id}-file`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          aria-invalid={errors.file ? true : undefined}
          aria-describedby={errors.file ? `${id}-file-error` : undefined}
        />
        {errors.file ? <small id={`${id}-file-error`} className="field-error" role="alert">{errors.file}</small> : null}
      </p>
      <p className="field">
        <label htmlFor={`${id}-alt`}>Descripción de la foto (obligatoria, para accesibilidad)</label>
        <input
          id={`${id}-alt`}
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          maxLength={200}
          required
          aria-invalid={errors.alt ? true : undefined}
          aria-describedby={errors.alt ? `${id}-alt-error` : undefined}
        />
        {errors.alt ? <small id={`${id}-alt-error`} className="field-error" role="alert">{errors.alt}</small> : null}
      </p>
      <div aria-live="polite">
        {result?.error ? <p role="alert" className="field-error">{result.error}</p> : null}
        {errors.photos ? <p role="alert" className="field-error">{errors.photos}</p> : null}
        {result?.success ? <p role="status">Foto agregada.</p> : null}
      </div>
      <button type="submit" aria-disabled={pending || !file || undefined}>
        {pending ? "Subiendo..." : "Subir foto"}
      </button>
    </form>
  );
}
