"use client";

import { useId, useState, type FormEvent } from "react";

import { removeBoardMemberPhoto, uploadBoardMemberPhoto } from "@/interface/admin/board/actions";

import { resultMessage, useRunAction } from "../../_components/use-run-action";

interface BoardMemberPhotoPanelProps {
  memberId: string;
  photo: { url: string; width: number; height: number; alt: string } | null;
}

export function BoardMemberPhotoPanel({ memberId, photo }: BoardMemberPhotoPanelProps) {
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
    formData.set("photoAlt", alt);
    upload.run(() => uploadBoardMemberPhoto(memberId, null, formData), () => {
      setFile(null);
      setAlt("");
      setInputKey((key) => key + 1);
    });
  }

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Foto</h2>
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={photo.alt} width={320} height={Math.round((320 * photo.height) / photo.width)} />
          <p>
            {confirming ? (
              <span role="group" aria-label="Confirmar quitar foto">
                ¿Quitar la foto? Si el integrante está publicado, pasa a borrador. Se borra del almacenamiento y no se puede deshacer.{" "}
                <button
                  type="button"
                  aria-disabled={remove.pending || undefined}
                  onClick={() => !remove.pending && remove.run(() => removeBoardMemberPhoto(memberId), () => setConfirming(false))}
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
                Quitar foto
              </button>
            )}
          </p>
        </>
      ) : (
        <p role="status">Este integrante no tiene foto.</p>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <p className="field">
          <label htmlFor={`${id}-file`}>
            {photo ? "Reemplazar foto" : "Agregar foto"} (JPEG, PNG o WebP, hasta 5 MB, mínimo 577 px de ancho)
          </label>
          <input
            key={inputKey}
            id={`${id}-file`}
            type="file"
            accept="photo/jpeg,photo/png,photo/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            aria-invalid={errors.file ? true : undefined}
            aria-describedby={errors.file ? `${id}-file-error` : undefined}
          />
          {errors.file ? <small id={`${id}-file-error`} className="field-error" role="alert">{errors.file}</small> : null}
        </p>
        <p className="field">
          <label htmlFor={`${id}-alt`}>Descripción de la foto nueva (obligatoria, para accesibilidad)</label>
          <input
            id={`${id}-alt`}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            maxLength={200}
            required
            aria-invalid={errors.photoAlt ? true : undefined}
            aria-describedby={errors.photoAlt ? `${id}-alt-error` : undefined}
          />
          {errors.photoAlt ? <small id={`${id}-alt-error`} className="field-error" role="alert">{errors.photoAlt}</small> : null}
        </p>
        <div aria-live="polite">
          {upload.result?.error ? <p role="alert" className="field-error">{upload.result.error}</p> : null}
          {upload.result?.success ? <p role="status">Foto guardada.</p> : null}
        </div>
        <button type="submit" aria-disabled={upload.pending || !file || undefined}>
          {upload.pending ? "Subiendo..." : photo ? "Reemplazar foto" : "Subir foto"}
        </button>
      </form>
    </section>
  );
}
