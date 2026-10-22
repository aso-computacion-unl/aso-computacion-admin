import { notFound } from "next/navigation";

import { updateFaq } from "@/interface/admin/faqs/actions";
import { getAdminFaq } from "@/interface/admin/faqs/faqs-admin-read";

import { FormPage, Panel } from "../../../_components/page-head";
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
    <FormPage backHref="/admin/faqs" backLabel="Volver a preguntas" title="Editar pregunta">
      <Panel>
        <FaqForm
          action={updateFaq.bind(null, id)}
          submitLabel="Guardar cambios"
          initialValues={{ question: faq.question, answer: faq.answer, isPublished: faq.isPublished }}
        />
      </Panel>
    </FormPage>
  );
}
