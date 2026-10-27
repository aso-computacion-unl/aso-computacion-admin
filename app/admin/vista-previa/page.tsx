import { createPreviewToken } from "@/interface/admin/preview/actions";
import { getPreviewSetup } from "@/interface/admin/preview/preview-admin-read";

import { PageHeader } from "../_components/page-header";
import { Panel } from "../_components/form-layout";
import { PreviewTokenForm } from "./_components/preview-token-form";

// Reads the environment on every request.
export const dynamic = "force-dynamic";

export default async function AdminPreviewPage() {
  const { configured, endpoint } = await getPreviewSetup();

  return (
    <div>
      <PageHeader
        title="Vista previa"
        status="Borradores y contenido programado, solo con código"
        description="Genere un código para ver en una versión de prueba lo que todavía no es público. Quien lo tenga ve ese contenido hasta que venza, así que compártalo solo con quien deba revisarlo."
      />

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
