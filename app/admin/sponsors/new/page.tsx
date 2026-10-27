import { createSponsor } from "@/interface/admin/sponsors/actions";

import { AsideNote, FormPage, Panel } from "../../_components/page-head";
import { SponsorForm } from "../_components/sponsor-form";

export default function NewSponsorPage() {
  return (
    <FormPage
      backHref="/admin/sponsors"
      backLabel="Volver a los aliados"
      title="Nuevo aliado"
      meta="Se agrega al final de la lista. El logo se sube en el paso siguiente y es necesario para publicar."
      aside={<AsideNote title="Logo">Se sube al guardar el aliado, en la pantalla de edición. Sin logo no se puede publicar.</AsideNote>}
    >
      <Panel>
        <SponsorForm action={createSponsor} submitLabel="Crear aliado" />
      </Panel>
    </FormPage>
  );
}
