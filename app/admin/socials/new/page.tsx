import { createSocialLink } from "@/interface/admin/socials/actions";

import { FormPage, Panel } from "../../_components/page-head";
import { SocialForm } from "../_components/social-form";

export default function NewSocialLinkPage() {
  return (
    <FormPage backHref="/admin/socials" backLabel="Volver a redes" title="Agregar red" meta="Se agrega al final de la lista; luego puede moverla.">
      <Panel>
        <SocialForm action={createSocialLink} submitLabel="Agregar red" />
      </Panel>
    </FormPage>
  );
}
