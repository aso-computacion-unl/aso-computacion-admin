import Link from "next/link";
import { notFound } from "next/navigation";

import { updateFaq } from "@/interface/admin/faqs/actions";
import { getAdminFaq } from "@/interface/admin/faqs/faqs-admin-read";

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
    <section>
      <p>
        <Link href="/admin/faqs">← Volver a preguntas</Link>
      </p>
      <h1>Editar pregunta</h1>
      <FaqForm
        action={updateFaq.bind(null, id)}
        submitLabel="Guardar cambios"
        initialValues={{ question: faq.question, answer: faq.answer, isPublished: faq.isPublished }}
      />
    </section>
  );
}
