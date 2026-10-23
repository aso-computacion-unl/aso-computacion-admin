"use client";

import { useId, useState, type FormEvent } from "react";

import { removePillarImage, uploadPillarImage } from "@/interface/admin/pillars/actions";

import { resultMessage, useRunAction } from "../../_components/use-run-action";

interface PillarImagePanelProps {
  pillarId: string;
  image: { url: string; width: number; height: number; alt: string } | null;
}

export function PillarImagePanel({ pillarId, image }: PillarImagePanelProps) {
  const id = useId();
  const upload = useRunAction();
  const remove = useRunAction();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [confirming, setConfirming] = useState(false);
  // Bumping the key remounts the file input, the only way to clear it.
  const [inputKey, setInputKey] = useState(0);
  const errors = upload.result?.fieldErrors ?? {};

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (upload.pending || !file) return;

    const formData = new FormData();
    formData.set("file", file);
    formData.set("imageAlt", alt);
    upload.run(() => uploadPillarImage(pillarId, null, formData), () => {
      setFile(null);
      setAlt("");
      setInputKey((key) => key + 1);
    });
  }

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Imagen</h2>
      {image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt={image.alt} width={320} height={Math.round((320 * image.height) / image.width)} />
          <p>
            {confirming ? (
              <span role="group" aria-label="Confirmar quitar imagen">
                ¿Quitar la imagen? Se borra del almacenamiento y no se puede deshacer.{" "}
                <button
                  type="button"
                  aria-disabled={remove.pending || undefined}
                  onClick={() => !remove.pending && remove.run(() => removePillarImage(pillarId), () => setConfirming(false))}
                >
                  Sí, quitar
                </button>{" "}
                <button type="button" aria-disabled={remove.pending || undefined} onClick={() => !remove.pending && setConfirming(false)}>
                  No, conservar
                </button>
                {remove.result?.error ? <small role="alert" className="field-error">{resultMessage(remove.result)}</small> : null}
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(true)}>
                Quitar imagen
              </button>
            )}
          </p>
        </>
      ) : (
        <p role="status">Este pilar no tiene imagen.</p>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <p className="field">
          <label htmlFor={`${id}-file`}>
            {image ? "Reemplazar imagen" : "Agregar imagen"} (JPEG, PNG o WebP, hasta 5 MB, mínimo 1200 px de ancho)
          </label>
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
          <label htmlFor={`${id}-alt`}>Descripción de la imagen nueva (obligatoria, para accesibilidad)</label>
          <input
            id={`${id}-alt`}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            maxLength={200}
            required
            aria-invalid={errors.imageAlt ? true : undefined}
            aria-describedby={errors.imageAlt ? `${id}-alt-error` : undefined}
          />
          {errors.imageAlt ? <small id={`${id}-alt-error`} className="field-error" role="alert">{errors.imageAlt}</small> : null}
        </p>
        <div aria-live="polite">
          {upload.result?.error ? <p role="alert" className="field-error">{upload.result.error}</p> : null}
          {upload.result?.success ? <p role="status">Imagen guardada.</p> : null}
        </div>
        <button type="submit" aria-disabled={upload.pending || !file || undefined}>
          {upload.pending ? "Subiendo..." : image ? "Reemplazar imagen" : "Subir imagen"}
        </button>
      </form>
    </section>
  );
}
