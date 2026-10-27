import { createFaq } from "@/interface/admin/faqs/actions";

import { FormPage, Panel } from "../../_components/page-head";
import { FaqForm } from "../_components/faq-form";

export default function NewFaqPage() {
  return (
    <FormPage
      backHref="/admin/faqs"
      backLabel="Volver a preguntas"
      title="Nueva pregunta"
      status="sin guardar"
      description="Se agrega al final de la lista; luego puede moverla."
    >
      <Panel>
        <FaqForm action={createFaq} submitLabel="Crear pregunta" />
      </Panel>
    </FormPage>
  );
}
