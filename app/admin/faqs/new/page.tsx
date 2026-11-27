import { createFaq } from "@/interface/admin/faqs/actions";

import { FormLayout } from "../../_components/form-layout";
import { FaqForm } from "../_components/faq-form";

export default function NewFaqPage() {
  return (
    <FormLayout backHref="/admin/faqs" backLabel="Volver a preguntas" title="Nueva pregunta" status="sin guardar" wide>
      <FaqForm action={createFaq} submitLabel="Crear pregunta" />
    </FormLayout>
  );
}
