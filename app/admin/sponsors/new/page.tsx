import { createSponsor } from "@/interface/admin/sponsors/actions";

import { FormLayout, Panel } from "../../_components/form-layout";
import { SponsorForm } from "../_components/sponsor-form";

export default function NewSponsorPage() {
  return (
    <FormLayout
      backHref="/admin/sponsors"
      backLabel="Volver a los aliados"
      title="Nuevo aliado"
      status="sin guardar"
      description="Se agrega al final de la lista. El logo se sube en el paso siguiente y es necesario para publicar."
    >
      <Panel>
        <SponsorForm action={createSponsor} submitLabel="Crear aliado" />
      </Panel>
    </FormLayout>
  );
}
