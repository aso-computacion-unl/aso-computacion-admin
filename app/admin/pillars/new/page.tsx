import { createPillar } from "@/interface/admin/pillars/actions";

import { FormLayout, Panel } from "../../_components/form-layout";
import { PillarForm } from "../_components/pillar-form";

export default function NewPillarPage() {
  return (
    <FormLayout
      backHref="/admin/pillars"
      backLabel="Volver a pilares"
      title="Nuevo pilar"
      status="sin guardar"
      description="Se agrega al final de la lista. La imagen es opcional y se sube al guardar, en la pantalla de edición."
    >
      <Panel>
        <PillarForm action={createPillar} submitLabel="Crear pilar" />
      </Panel>
    </FormLayout>
  );
}
