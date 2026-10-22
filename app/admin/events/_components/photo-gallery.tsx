"use client";

import { useState, type FormEvent } from "react";

import { MAX_ACTIVE_EVENT_PHOTOS } from "@/domain/event-photo";
import { deactivateEventPhoto, moveEventPhoto, updateEventPhotoAlt } from "@/interface/admin/events/actions";

import { PhotoUploadForm } from "./photo-upload-form";
import { resultMessage, useRunAction } from "../../_components/use-run-action";

export interface GalleryPhoto {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
}

interface PhotoItemProps {
  eventId: string;
  photo: GalleryPhoto;
  position: number;
  total: number;
}

function PhotoItem({ eventId, photo, position, total }: PhotoItemProps) {
  const [alt, setAlt] = useState(photo.alt);
  const [confirming, setConfirming] = useState(false);
  const altAction = useRunAction();
  const moveAction = useRunAction();
  const removeAction = useRunAction();
  const busy = altAction.pending || moveAction.pending || removeAction.pending;
  const label = `foto ${position} de ${total}`;
  const altId = `photo-alt-${photo.id}`;

  function saveAlt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const formData = new FormData();
    formData.set("alt", alt);
    altAction.run(() => updateEventPhotoAlt(eventId, photo.id, null, formData));
  }

  const message = [altAction.result, moveAction.result, removeAction.result].map(resultMessage).find(Boolean);

  return (
    <li>
      {/* Remote Cloudinary asset shown as-is in the admin; no image optimisation needed. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photo.alt} width={192} height={Math.round((192 * photo.height) / photo.width)} />
      <form onSubmit={saveAlt} noValidate>
        <label htmlFor={altId}>Descripción ({label})</label>
        <input id={altId} value={alt} onChange={(event) => setAlt(event.target.value)} maxLength={200} required />
        <button type="submit" aria-disabled={busy || undefined}>
          Guardar descripción
        </button>
      </form>
      <div role="group" aria-label={`Orden de la ${label}`}>
        <button
          type="button"
          disabled={position === 1}
          aria-disabled={busy || undefined}
          onClick={() => !busy && moveAction.run(() => moveEventPhoto(eventId, photo.id, "up"))}
        >
          Subir
        </button>{" "}
        <button
          type="button"
          disabled={position === total}
          aria-disabled={busy || undefined}
          onClick={() => !busy && moveAction.run(() => moveEventPhoto(eventId, photo.id, "down"))}
        >
          Bajar
        </button>
      </div>
      {confirming ? (
        <div role="group" aria-label={`Confirmar quitar la ${label}`}>
          <p>La foto deja de mostrarse en el evento. El archivo se conserva.</p>
          <button
            type="button"
            aria-disabled={busy || undefined}
            onClick={() => !busy && removeAction.run(() => deactivateEventPhoto(eventId, photo.id))}
          >
            Sí, quitar
          </button>{" "}
          <button type="button" aria-disabled={busy || undefined} onClick={() => !busy && setConfirming(false)}>
            No, conservar
          </button>
        </div>
      ) : (
        <button type="button" aria-label={`Quitar ${label}`} onClick={() => setConfirming(true)}>
          Quitar de la galería
        </button>
      )}
      <div aria-live="polite">{message ? <p role="alert" className="field-error">{message}</p> : null}</div>
    </li>
  );
}

interface PhotoGalleryProps {
  eventId: string;
  photos: GalleryPhoto[];
}

export function PhotoGallery({ eventId, photos }: PhotoGalleryProps) {
  return (
    <section aria-labelledby="gallery-heading">
      <h2 id="gallery-heading">
        Fotos ({photos.length} de {MAX_ACTIVE_EVENT_PHOTOS})
      </h2>
      <p className="field-hint">El orden de abajo es el orden en que se muestran en el sitio.</p>
      <PhotoUploadForm eventId={eventId} activeCount={photos.length} />
      {photos.length === 0 ? (
        <p role="status">Todavía no hay fotos.</p>
      ) : (
        <ol className="photo-list">
          {photos.map((photo, index) => (
            <PhotoItem key={photo.id} eventId={eventId} photo={photo} position={index + 1} total={photos.length} />
          ))}
        </ol>
      )}
    </section>
  );
}
