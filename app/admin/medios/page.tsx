import Link from "next/link";

import { Button } from "@/components/ui/button";
import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";
import { requirePageSession } from "@/interface/auth/require-page-session";
import { getAdminMediaLibrary } from "@/interface/admin/media/media-admin-read";
import { formatBytes, MEDIA_KIND_LABELS, mediaHref, parseMediaCursor, usageHref } from "@/interface/admin/media/media-labels";
import { pluralize } from "@/interface/admin/publication-summary";

import { PageHead } from "../_components/page-head";
import { EmptyState } from "../_components/timeline-parts";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const STEP_CLASSES =
  "inline-flex min-h-11 items-center rounded border border-input px-3.5 text-sm font-semibold text-mist transition-colors duration-150 ease-out hover:bg-foreground/6 hover:text-foreground";

export default async function AdminMediaPage({ searchParams }: { searchParams: Promise<{ despues?: string | string[] }> }) {
  const cursor = parseMediaCursor((await searchParams).despues);
  const actor = await requirePageSession();
  const library = await getAdminMediaLibrary(cursor);

  return (
    <div>
      <PageHead
        title="Medios"
        meta={library.status === "ok" ? `${pluralize(library.items.length, "imagen", "imágenes")} en esta página` : undefined}
        action={
          actor.role === "ADMIN" ? (
            <Button asChild variant="line" className="min-h-12 flex-none">
              <Link href="/admin/medios/limpieza">Buscar imágenes sin uso</Link>
            </Button>
          ) : undefined
        }
      />
      <p className="mt-4 max-w-2xl text-mist">
        Las imágenes guardadas y dónde se usa cada una. Reemplazar o quitar una imagen en un contenido no borra el archivo: sigue aquí, sin uso, hasta que se elimine.
      </p>

      {library.status === "unavailable" ? <EmptyState>El almacén de imágenes no está configurado en este entorno, así que no se puede mostrar la biblioteca.</EmptyState> : null}
      {library.status === "error" ? <EmptyState>No se pudo consultar el almacén de imágenes. Intente nuevamente en unos minutos.</EmptyState> : null}
      {library.status === "ok" && library.items.length === 0 ? <EmptyState>Todavía no hay imágenes guardadas.</EmptyState> : null}

      {library.status === "ok" && library.items.length > 0 ? (
        <>
          <ul aria-label="Imágenes guardadas" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {library.items.map((item) => (
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
                    {item.width}×{item.height} · {formatBytes(item.bytes)} · {item.createdAt.toLocaleDateString("es-EC", { timeZone: "America/Guayaquil", dateStyle: "medium" })}
                  </p>
                </div>
                {item.usedBy.length === 0 ? (
                  <p className="text-sm font-semibold text-signal">Sin uso</p>
                ) : (
                  <ul aria-label={`Dónde se usa ${item.publicId}`} className="grid gap-1 text-sm">
                    {item.usedBy.map((use) => (
                      <li key={`${use.kind}-${use.id}`}>
                        <Link href={usageHref(use)} className="rounded-xs underline-offset-4 hover:underline">
                          {MEDIA_KIND_LABELS[use.kind]}: {use.label}
                        </Link>
                        {use.hidden ? <span className="text-mist"> (oculta)</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <nav aria-label="Paginación" className="mt-6 flex flex-wrap items-center gap-4 text-sm text-mist">
            {cursor ? (
              <Link href={mediaHref()} className={STEP_CLASSES}>
                Volver al principio
              </Link>
            ) : null}
            {library.nextCursor ? (
              <Link href={mediaHref(library.nextCursor)} rel="next" className={STEP_CLASSES}>
                Siguiente
              </Link>
            ) : (
              <p role="status">No hay más imágenes.</p>
            )}
          </nav>
        </>
      ) : null}
    </div>
  );
}
