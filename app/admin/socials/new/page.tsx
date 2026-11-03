import { createSocialLink } from "@/interface/admin/socials/actions";

import { FormLayout, Panel } from "../../_components/form-layout";
import { SocialForm } from "../_components/social-form";

export default function NewSocialLinkPage() {
  return (
    <FormLayout
      backHref="/admin/socials"
      backLabel="Volver a redes"
      title="Agregar red"
      status="sin guardar"
      description="Se agrega al final de la lista; luego puede moverla."
    >
      <Panel>
        <SocialForm action={createSocialLink} submitLabel="Agregar red" />
      </Panel>
    </FormLayout>
  );
}
