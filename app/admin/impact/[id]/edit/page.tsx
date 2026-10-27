import { notFound } from "next/navigation";

import { updateImpactStat } from "@/interface/admin/impact/actions";
import { getAdminImpactStat } from "@/interface/admin/impact/impact-admin-read";

import { recordStatus } from "../../../_components/page-header";
import { FormLayout, Panel } from "../../../_components/form-layout";
import { ImpactStatForm } from "../../_components/impact-stat-form";

export const dynamic = "force-dynamic";

interface EditImpactStatPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditImpactStatPage({ params }: EditImpactStatPageProps) {
  const { id } = await params;
  const stat = await getAdminImpactStat(id);

  if (!stat) notFound();

  return (
    <FormLayout
      backHref="/admin/impact"
      backLabel="Volver al impacto"
      title="Editar cifra de impacto"
      status={recordStatus(stat.label, stat.isPublished, "f")}
    >
      <Panel>
        <ImpactStatForm
          action={updateImpactStat.bind(null, id)}
          submitLabel="Guardar cambios"
          initialValues={{ value: stat.value, label: stat.label, isPublished: stat.isPublished }}
        />
      </Panel>
    </FormLayout>
  );
}
