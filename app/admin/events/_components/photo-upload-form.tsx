"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_ACTIVE_EVENT_PHOTOS } from "@/domain/event-photo";
import { uploadEventPhoto } from "@/interface/admin/events/actions";

import { FieldError } from "../../_components/form-parts";
import { useToast } from "../../_components/toast";
import { resultMessage } from "../../_components/use-run-action";

interface PhotoUploadFormProps {
  eventId: string;
  activeCount: number;
  /** The server's floor, shown early so a small photo is caught before it is sent. */
  minWidth: number;
}

/** `invalid` cannot be fixed by waiting (wrong format, too big or small); `failed` can be retried as it is. */
type QueueStatus = "ready" | "uploading" | "failed" | "invalid";

interface QueuedPhoto {
  key: string;
  file: File;
  alt: string;
  previewUrl: string;
  width: number | null;
  status: QueueStatus;
  error?: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The width the browser decodes, or null when it cannot (the server then decides on its own). */
async function readWidth(file: File): Promise<number | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width } = bitmap;
    bitmap.close();

    return width;
  } catch {
    return null;
  }
}

/** Why a file cannot be sent at all, or undefined when it is worth trying. */
function localProblem(file: File, width: number | null, minWidth: number): string | undefined {
  if (!ACCEPTED.includes(file.type)) return "Solo JPEG, PNG o WebP.";
  if (file.size > MAX_BYTES) return `Pesa ${formatSize(file.size)}; el máximo es 5 MB.`;
  if (width !== null && width < minWidth) return `Mide ${width} px de ancho; el mínimo es ${minWidth} px.`;

  return undefined;
}

/**
 * Pick several photos at once, describe each one, send them all with one tap. Each photo is
 * still one `uploadEventPhoto` call (one at a time, so the gallery order follows the queue),
 * so the server keeps every check it already had.
 */
export function PhotoUploadForm({ eventId, activeCount, minWidth }: PhotoUploadFormProps) {
  const id = useId();
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [uploading, startUpload] = useTransition();
  const { notify } = useToast();
  const [inputKey, setInputKey] = useState(0);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const remaining = MAX_ACTIVE_EVENT_PHOTOS - activeCount - queue.length;
  const full = activeCount >= MAX_ACTIVE_EVENT_PHOTOS;

  // Previews are object URLs: release them all when the form goes away.
  useEffect(() => () => queueRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)), []);

  async function addFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    setInputKey((key) => key + 1);
    setShowMissing(false);
    if (files.length === 0) return;

    const room = Math.max(0, remaining);
    const accepted = files.slice(0, room);
    setNotice(
      files.length > accepted.length
        ? `Caben ${room} foto${room === 1 ? "" : "s"} más (máximo ${MAX_ACTIVE_EVENT_PHOTOS} por evento): se omitieron ${files.length - accepted.length}.`
        : null,
    );

    const items: QueuedPhoto[] = await Promise.all(
      accepted.map(async (file, index) => {
        const width = await readWidth(file);
        const problem = localProblem(file, width, minWidth);

        return {
          key: `${id}-${Date.now()}-${index}`,
          file,
          alt: "",
          previewUrl: URL.createObjectURL(file),
          width,
          status: problem ? ("invalid" as const) : ("ready" as const),
          error: problem,
        };
      }),
    );

    setQueue((previous) => [...previous, ...items]);
  }

  function update(key: string, patch: Partial<QueuedPhoto>) {
    setQueue((previous) => previous.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function discard(key: string) {
    const item = queue.find((entry) => entry.key === key);
    if (item) URL.revokeObjectURL(item.previewUrl);
    setQueue((previous) => previous.filter((entry) => entry.key !== key));
  }

  const sendable = queue.filter((item) => item.status === "ready" || item.status === "failed");
  const missing = sendable.filter((item) => item.alt.trim() === "");

  function send() {
    if (uploading || sendable.length === 0) return;

    if (missing.length > 0) {
      setShowMissing(true);
      document.getElementById(`${id}-alt-${missing[0]!.key}`)?.focus();
      return;
    }

    startUpload(async () => {
      let uploaded = 0;

      for (const item of sendable) {
        update(item.key, { status: "uploading", error: undefined });

        const formData = new FormData();
        formData.set("file", item.file);
        formData.set("alt", item.alt.trim());

        let message: string | undefined;

        try {
          const result = await uploadEventPhoto(eventId, null, formData);
          message = result.success ? undefined : (resultMessage(result) ?? "No se pudo subir la foto.");
        } catch {
          message = "No se pudo subir la foto. Revise la conexión e intente de nuevo.";
        }

        if (message) {
          update(item.key, { status: "failed", error: message });
        } else {
          URL.revokeObjectURL(item.previewUrl);
          setQueue((previous) => previous.filter((entry) => entry.key !== item.key));
          uploaded += 1;
        }
      }

      if (uploaded > 0) notify(uploaded === 1 ? "Foto subida." : `${uploaded} fotos subidas.`);
    });
  }

  if (full && queue.length === 0) {
    return (
      <p role="status" className="rounded border border-dashed border-mist/50 p-4 text-sm text-mist">
        La galería tiene el máximo de {MAX_ACTIVE_EVENT_PHOTOS} fotos. Quite una para subir otra.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <label
        className={cn(
          "relative grid cursor-pointer justify-items-center gap-1.5 rounded border-2 border-dashed border-sky/70 bg-muted/55 px-4 py-5 text-center",
          "transition-colors duration-150 ease-out hover:border-sky hover:bg-sky/14 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-sky",
          (remaining <= 0 || uploading) && "pointer-events-none opacity-50",
        )}
      >
        <Icon name="upload" className="size-7 text-sky" />
        <span>
          <strong className="font-bold font-stretch-[112%]">Elegir fotos</strong>
          <span className="hidden md:inline"> o arrastrarlas aquí</span>
        </span>
        <span className="text-xs leading-snug text-mist">
          JPEG, PNG o WebP · hasta 5 MB cada una · mínimo {minWidth} px de ancho · caben {Math.max(0, remaining)} más
        </span>
        <input
          key={inputKey}
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          disabled={remaining <= 0 || uploading}
          onChange={(event) => void addFiles(event.target.files)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Elegir fotos para subir"
        />
      </label>

      {notice ? (
        <p role="status" className="text-sm text-mist">
          {notice}
        </p>
      ) : null}

      {queue.length > 0 ? (
        <>
          <ul aria-label="Fotos por subir" className="grid gap-3 sm:grid-cols-2">
            {queue.map((item) => {
              const altMissing = showMissing && item.status !== "invalid" && item.status !== "uploading" && item.alt.trim() === "";

              return (
                <li key={item.key} className={cn("grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 rounded bg-muted p-2.5", (item.status === "invalid" || item.status === "failed") && "ring-1 ring-error/60")}>
                  {/* Local object URL of a file the person just picked; nothing to optimise. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt="" decoding="async" width={88} height={66} className={cn("aspect-4/3 w-full rounded-xs object-cover", item.status === "invalid" && "opacity-45 grayscale")} />
                  <div className="grid min-w-0 content-start gap-1.5">
                    <p className="truncate font-mono text-[0.6875rem] text-mist" title={item.file.name}>
                      {item.file.name} · {item.width ? `${item.width} px` : "…"} · {formatSize(item.file.size)}
                    </p>
                    {item.error ? <FieldError>{item.error}</FieldError> : null}
                    {item.status !== "invalid" ? (
                      <>
                        <label htmlFor={`${id}-alt-${item.key}`} className="text-[0.8125rem] leading-[1.3] font-[650]">
                          Descripción <span className="font-mono text-xs font-normal text-mist">obligatoria</span>
                        </label>
                        <Textarea
                          id={`${id}-alt-${item.key}`}
                          rows={2}
                          maxLength={200}
                          value={item.alt}
                          disabled={item.status === "uploading"}
                          aria-invalid={altMissing ? true : undefined}
                          onChange={(event) => update(item.key, { alt: event.target.value })}
                          className="min-h-0 bg-navy px-2 py-1.5 text-sm"
                        />
                        {altMissing ? <FieldError>Describa la foto para quien no la pueda ver.</FieldError> : null}
                      </>
                    ) : null}
                    <div className="flex items-center justify-between gap-2">
                      {item.status === "uploading" ? (
                        <span role="status" className="font-mono text-xs text-sky">Subiendo…</span>
                      ) : (
                        <span />
                      )}
                      <Button variant="quiet" size="sm" disabled={item.status === "uploading"} onClick={() => discard(item.key)}>
                        <Icon name="x" className="size-4" />
                        Quitar<span className="sr-only"> {item.file.name} de la lista</span>
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-mist" aria-live="polite">
              {missing.length > 0 && showMissing
                ? `Falta la descripción de ${missing.length} foto${missing.length === 1 ? "" : "s"}.`
                : sendable.length > 0
                  ? `${sendable.length} foto${sendable.length === 1 ? "" : "s"} lista${sendable.length === 1 ? "" : "s"} para subir.`
                  : "Ninguna foto se puede subir; quite las marcadas."}
            </p>
            <Button
              busy={uploading}
              aria-disabled={uploading || sendable.length === 0 || (missing.length > 0 && showMissing) || undefined}
              onClick={send}
            >
              <Icon name="upload" />
              {uploading ? "Subiendo…" : `Subir ${sendable.length} foto${sendable.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
