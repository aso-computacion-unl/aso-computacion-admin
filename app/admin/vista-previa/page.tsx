import { createPreviewToken } from "@/interface/admin/preview/actions";
import { getPreviewSetup } from "@/interface/admin/preview/preview-admin-read";

import { PageHead, Panel } from "../_components/page-head";
import { PreviewTokenForm } from "./_components/preview-token-form";

// Reads the environment on every request.
export const dynamic = "force-dynamic";

export default async function AdminPreviewPage() {
  const { configured, endpoint } = await getPreviewSetup();

  return (
    <div>
      <PageHead title="Vista previa" meta="Borradores y contenido programado, solo con código" />
      <p className="mt-4 max-w-2xl text-mist">
        Genere un código para ver en una versión de prueba del sitio lo que todavía no es público: borradores y contenido programado. Quien tenga el código
        puede ver ese contenido hasta que venza, así que compártalo solo con quien deba revisarlo. Sin el código, el sitio público sigue mostrando únicamente
        lo publicado.
      </p>

      <Panel className="mt-6" aria-labelledby="preview-title">
        <h2 id="preview-title" className="mb-4 text-lg font-bold font-stretch-[112%]">
          Generar un código
        </h2>
        {configured ? (
          <PreviewTokenForm action={createPreviewToken} endpoint={endpoint} />
        ) : (
          <p role="status" className="text-mist">
            La vista previa no está configurada en este servidor. Pida a quien administra el despliegue que defina PREVIEW_TOKEN_SECRET.
          </p>
        )}
      </Panel>
    </div>
  );
}
