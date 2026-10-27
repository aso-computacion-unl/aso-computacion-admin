import Link from "next/link";

import { getAdminOrphanScan } from "@/interface/admin/media/media-cleanup-admin-read";
import { parseMediaCursor } from "@/interface/admin/media/media-labels";
import { pluralize } from "@/interface/admin/publication-summary";

import { BackLink, PageHead } from "../../_components/page-head";
import { EmptyState } from "../../_components/empty-state";
import { OrphanCleanup } from "./_components/orphan-cleanup";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const STEP_CLASSES =
  "inline-flex min-h-11 items-center rounded border border-input px-3.5 text-sm font-semibold text-mist transition-colors duration-150 ease-out hover:bg-foreground/6 hover:text-foreground";

export default async function AdminMediaCleanupPage({ searchParams }: { searchParams: Promise<{ despues?: string | string[] }> }) {
  const cursor = parseMediaCursor((await searchParams).despues);
  const scan = await getAdminOrphanScan(cursor);

  return (
    <div>
      <BackLink href="/admin/medios">Medios</BackLink>
      <PageHead
        title="Imágenes sin uso"
        meta={scan.status === "ok" ? `${pluralize(scan.scanned, "imagen revisada", "imágenes revisadas")} · ${pluralize(scan.orphans.length, "sin uso", "sin uso")}` : undefined}
      />
      <p className="mt-4 max-w-2xl text-mist">
        Esta revisión no borra nada: solo muestra, de a una página del almacén, las imágenes que ningún contenido usa. Elegir y confirmar es lo que elimina los archivos, y no se
        puede deshacer. Las subidas en las últimas 24 horas no se pueden elegir, porque pueden estar a medio guardar.
      </p>

      {scan.status === "ok" && scan.notManaged > 0 ? (
        <p role="status" className="mt-3 max-w-2xl text-sm text-mist">
          {pluralize(scan.notManaged, "imagen está", "imágenes están")} en carpetas que esta revisión no cubre (contenido cuyo uso no se comprueba aquí). No se ofrecen ni se pueden eliminar desde esta
          pantalla.
        </p>
      ) : null}
      {scan.status === "unavailable" ? <EmptyState icon="image">El almacén de imágenes no está configurado en este entorno.</EmptyState> : null}
      {scan.status === "error" ? <EmptyState icon="image">No se pudo consultar el almacén de imágenes. Intente nuevamente en unos minutos.</EmptyState> : null}
      {scan.status === "ok" ? (
        <>
          {/* Keyed by the page: a new page starts with a clean selection. */}
          <OrphanCleanup
            key={cursor ?? "first"}
            items={scan.orphans.map((orphan) => ({
              publicId: orphan.publicId,
              url: orphan.url,
              width: orphan.width,
              height: orphan.height,
              bytes: orphan.bytes,
              uploaded: orphan.createdAt.toLocaleDateString("es-EC", { timeZone: "America/Guayaquil", dateStyle: "medium" }),
              deletable: orphan.deletable,
            }))}
          />
          <nav aria-label="Paginación" className="mt-6 flex flex-wrap items-center gap-4 text-sm text-mist">
            {cursor ? (
              <Link href="/admin/medios/limpieza" className={STEP_CLASSES}>
                Volver al principio
              </Link>
            ) : null}
            {scan.nextCursor ? (
              <Link href={`/admin/medios/limpieza?despues=${encodeURIComponent(scan.nextCursor)}`} rel="next" className={STEP_CLASSES}>
                Revisar la página siguiente
              </Link>
            ) : (
              <p role="status">Se revisó todo el almacén.</p>
            )}
          </nav>
        </>
      ) : null}
    </div>
  );
}
