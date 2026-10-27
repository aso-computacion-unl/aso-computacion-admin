"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { selectAll, settle, toggle } from "@/interface/admin/bulk/bulk-selection";
import { deleteOrphanImages } from "@/interface/admin/media/actions";
import { formatBytes } from "@/interface/admin/media/media-labels";
import { deleteInBatches } from "@/interface/admin/media/orphan-batches";
import { pluralize } from "@/interface/admin/publication-summary";
import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";

import { useToast } from "../../../_components/toast";

export interface OrphanItem {
  publicId: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  /** Already formatted on the server, so the server and the browser agree on the day. */
  uploaded: string;
  deletable: boolean;
}

/**
 * The second half of the cleanup: the images the dry run found, each with a checkbox (the ones
 * uploaded in the last 24 hours have none). Nothing is destroyed until the person has chosen
 * images and confirmed; what could not be deleted stays selected with its reason.
 */
export function OrphanCleanup({ items }: { items: readonly OrphanItem[] }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [failures, setFailures] = useState<{ id: string; error: string }[]>([]);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const { notify } = useToast();
  const shown = items.filter((item) => !removed.has(item.publicId));
  const deletable = shown.filter((item) => item.deletable).map((item) => item.publicId);
  const allSelected = deletable.length > 0 && deletable.every((id) => selected.has(id));

  function run() {
    const chosen = [...selected];

    setProblem(null);
    setFailures([]);
    startTransition(async () => {
      // A long selection goes as several requests (each has its own time limit); what finished is kept.
      const { results, problem: stopped } = await deleteInBatches(chosen, deleteOrphanImages);
      const outcome = settle(selected, results);

      setConfirming(false);
      setProblem(stopped);
      setSelected(outcome.remaining);
      setFailures(outcome.failures);
      setRemoved((previous) => new Set([...previous, ...results.filter((item) => item.ok).map((item) => item.id)]));
      if (outcome.okCount > 0) notify(`${pluralize(outcome.okCount, "imagen eliminada", "imágenes eliminadas")}.`);
    });
  }

  if (shown.length === 0) return <p className="mt-6 text-mist">No hay imágenes sin uso en esta página.</p>;

  return (
    <section aria-label="Imágenes sin uso" className="mt-6 grid gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded bg-card p-3 md:px-4">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={allSelected}
            disabled={pending || deletable.length === 0}
            onChange={() => setSelected(selectAll(deletable, !allSelected))}
            className="size-5 cursor-pointer accent-sky"
          />
          Seleccionar todas las que se pueden eliminar
        </label>
        <p role="status" className="font-mono text-[0.8125rem] text-mist">
          {selected.size === 0 ? "Nada seleccionado" : pluralize(selected.size, "seleccionada", "seleccionadas")}
        </p>
        {selected.size > 0 && !confirming ? (
          <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
            Eliminar las seleccionadas
          </Button>
        ) : null}
      </div>

      {confirming ? (
        <div role="group" aria-label="Confirmar: eliminar imágenes" className="grid gap-3 rounded bg-muted p-3 text-sm">
          <p>
            ¿Eliminar {pluralize(selected.size, "imagen", "imágenes")} para siempre? Los archivos se borran del almacén y esto no se puede deshacer. Antes de borrar cada una se
            vuelve a comprobar que nada la use.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="sm" busy={pending} aria-disabled={pending || undefined} onClick={() => !pending && run()}>
              Sí, eliminar definitivamente
            </Button>
            <Button variant="line" size="sm" aria-disabled={pending || undefined} onClick={() => !pending && setConfirming(false)} autoFocus>
              No, conservar
            </Button>
          </div>
        </div>
      ) : null}

      {problem ? (
        <p role="alert" className="text-sm font-semibold text-signal">
          {problem}
        </p>
      ) : null}
      {failures.length > 0 ? (
        <div role="alert" className="grid gap-1.5 text-sm">
          <p className="font-semibold text-signal">{failures.length === 1 ? "1 imagen no se eliminó:" : `${failures.length} imágenes no se eliminaron:`}</p>
          <ul className="grid gap-1 pl-4">
            {failures.map((failure) => (
              <li key={failure.id} className="list-disc wrap-anywhere">
                {failure.id}: {failure.error}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((item) => (
          <li key={item.publicId} className="grid content-start gap-3 rounded bg-card p-4">
            {/* Remote Cloudinary asset, requested at thumbnail size; a plain <img> is enough in the admin. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl(item.url, 240, 160)}
              alt=""
              loading="lazy"
              decoding="async"
              width={240}
              height={160}
              className="aspect-3/2 w-full rounded-xs bg-muted object-cover"
            />
            <div className="grid gap-1">
              <p className="font-mono text-xs break-all text-mist">{item.publicId}</p>
              <p className="font-mono text-xs text-mist">
                {item.width}×{item.height} · {formatBytes(item.bytes)} · {item.uploaded}
              </p>
            </div>
            {item.deletable ? (
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={selected.has(item.publicId)}
                  disabled={pending}
                  onChange={() => setSelected((previous) => toggle(previous, item.publicId))}
                  aria-label={`Seleccionar: ${item.publicId}`}
                  className="size-5 cursor-pointer accent-sky"
                />
                Eliminar
              </label>
            ) : (
              <p className="text-sm text-mist">Subida hace menos de 24 horas: puede estar en uso todavía.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
