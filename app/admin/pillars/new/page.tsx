import { createPillar } from "@/interface/admin/pillars/actions";

import { AsideNote, FormPage, Panel } from "../../_components/page-head";
import { PillarForm } from "../_components/pillar-form";

export default function NewPillarPage() {
  return (
    <FormPage
      backHref="/admin/pillars"
      backLabel="Volver a pilares"
      title="Nuevo pilar"
      meta="Se agrega al final de la lista. La imagen se sube en el paso siguiente."
      aside={<AsideNote title="Imagen">Opcional. Se agrega al guardar el pilar, en la pantalla de edición.</AsideNote>}
    >
      <Panel>
        <PillarForm action={createPillar} submitLabel="Crear pilar" />
      </Panel>
    </FormPage>
  );
}
