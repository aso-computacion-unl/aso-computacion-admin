"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_ACTIVE_EVENT_PHOTOS } from "@/domain/event-photo";
import { deactivateEventPhoto, moveEventPhoto, updateEventPhotoAlt } from "@/interface/admin/events/actions";

import { Panel } from "../../_components/page-head";
import { FieldError } from "../../_components/form-parts";
import { DeleteButton, MoveButtons } from "../../_components/row-actions";
import { resultMessage, useRunAction } from "../../_components/use-run-action";
import { PhotoUploadForm } from "./photo-upload-form";

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
  const altAction = useRunAction();
  const label = `foto ${position} de ${total}`;
  const altId = `photo-alt-${photo.id}`;
  const dirty = alt.trim() !== photo.alt.trim();

  function saveAlt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (altAction.pending || !dirty) return;

    const formData = new FormData();
    formData.set("alt", alt);
    altAction.run(() => updateEventPhotoAlt(eventId, photo.id, null, formData));
  }

  const message = resultMessage(altAction.result);

  return (
    <li className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 rounded bg-muted p-2.5 sm:grid-cols-1 sm:p-2 sm:pb-2.5">
      <div className="relative aspect-4/3 self-start overflow-hidden rounded-xs bg-navy">
        {/* Remote Cloudinary asset shown as-is in the admin; no image optimisation needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.alt} width={320} height={Math.round((320 * photo.height) / photo.width)} className="size-full object-cover" />
        <span className="absolute top-1 left-1 bg-muted px-1.5 py-0.75 font-mono text-[0.6875rem] leading-none">
          <span className="sr-only">Foto </span>
          {String(position).padStart(2, "0")}
        </span>
      </div>

      <form onSubmit={saveAlt} noValidate className="grid min-w-0 content-start gap-1.5">
        <Label htmlFor={altId} className="text-[0.8125rem]">
          Descripción <span className="sr-only">({label})</span>
        </Label>
        <Textarea
          id={altId}
          value={alt}
          rows={3}
          maxLength={200}
          required
          onChange={(event) => setAlt(event.target.value)}
          className="min-h-0 bg-navy px-2 py-1.5 text-sm"
        />
        {dirty || altAction.pending ? (
          <Button type="submit" variant="line" size="sm" busy={altAction.pending} aria-disabled={altAction.pending || undefined} className="justify-self-start">
            Guardar descripción
          </Button>
        ) : null}
      </form>

      <div className="col-span-2 flex flex-wrap items-center gap-x-1 gap-y-1 sm:col-span-1">
        <MoveButtons
          label={label}
          isFirst={position === 1}
          isLast={position === total}
          position={position}
          total={total}
          action={(direction) => moveEventPhoto(eventId, photo.id, direction)}
        />
        <div className="ml-auto">
          <DeleteButton
            label={label}
            warning="La foto deja de mostrarse en el evento."
            note="El archivo se conserva."
            triggerLabel="Quitar"
            confirmLabel="Sí, quitar"
            action={() => deactivateEventPhoto(eventId, photo.id)}
          />
        </div>
      </div>
      <div aria-live="polite" className="col-span-2 sm:col-span-1">
        {message ? <FieldError>{message}</FieldError> : null}
      </div>
    </li>
  );
}

interface PhotoGalleryProps {
  eventId: string;
  photos: GalleryPhoto[];
  minWidth: number;
}

export function PhotoGallery({ eventId, photos, minWidth }: PhotoGalleryProps) {
  return (
    <Panel aria-labelledby="gallery-heading" className="grid gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="gallery-heading" className="text-lg font-bold font-stretch-[112%]">
          Fotos
        </h2>
        <p className="font-mono text-[0.8125rem] text-mist">
          {photos.length} de {MAX_ACTIVE_EVENT_PHOTOS}
        </p>
      </div>
      <PhotoUploadForm eventId={eventId} activeCount={photos.length} minWidth={minWidth} />
      {photos.length === 0 ? (
        <p role="status" className="text-mist">
          Todavía no hay fotos. El orden de esta lista es el orden en que se muestran en el sitio.
        </p>
      ) : (
        <>
          <p className="text-sm text-mist">El orden de esta lista es el orden en que se muestran en el sitio.</p>
          <ol aria-label="Fotos del evento" className="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] sm:gap-4">
            {photos.map((photo, index) => (
              <PhotoItem key={photo.id} eventId={eventId} photo={photo} position={index + 1} total={photos.length} />
            ))}
          </ol>
        </>
      )}
    </Panel>
  );
}
