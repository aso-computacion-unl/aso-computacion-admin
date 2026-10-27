import { createImpactStat } from "@/interface/admin/impact/actions";

import { FormLayout, Panel } from "../../_components/form-layout";
import { ImpactStatForm } from "../_components/impact-stat-form";

export default function NewImpactStatPage() {
  return (
    <FormLayout
      backHref="/admin/impact"
      backLabel="Volver al impacto"
      title="Nueva cifra de impacto"
      status="sin guardar"
      description="Se agrega al final de la lista. Solo se publica si usted la marca como publicada."
    >
      <Panel>
        <ImpactStatForm action={createImpactStat} submitLabel="Crear cifra" />
      </Panel>
    </FormLayout>
  );
}
