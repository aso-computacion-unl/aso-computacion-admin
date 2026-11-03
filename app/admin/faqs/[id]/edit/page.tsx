import { notFound } from "next/navigation";

import { updateFaq } from "@/interface/admin/faqs/actions";
import { getAdminFaq } from "@/interface/admin/faqs/faqs-admin-read";

import { recordStatus } from "../../../_components/page-header";
import { FormLayout, Panel } from "../../../_components/form-layout";
import { FaqForm } from "../../_components/faq-form";

export const dynamic = "force-dynamic";

interface EditFaqPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditFaqPage({ params }: EditFaqPageProps) {
  const { id } = await params;
  const faq = await getAdminFaq(id);

  if (!faq) notFound();

  return (
    <FormLayout
      backHref="/admin/faqs"
      backLabel="Volver a preguntas"
      title="Editar pregunta"
      status={recordStatus(faq.question, faq.isPublished, "f")}
    >
      <Panel>
        <FaqForm
          action={updateFaq.bind(null, id)}
          submitLabel="Guardar cambios"
          initialValues={{ question: faq.question, answer: faq.answer, command: faq.command ?? "", isPublished: faq.isPublished }}
        />
      </Panel>
    </FormLayout>
  );
}
