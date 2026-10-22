import Link from "next/link";

import { createFaq } from "@/interface/admin/faqs/actions";

import { FaqForm } from "../_components/faq-form";

export default function NewFaqPage() {
  return (
    <section>
      <p>
        <Link href="/admin/faqs">← Volver a preguntas</Link>
      </p>
      <h1>Crear pregunta</h1>
      <p>Se agrega al final de la lista; luego puede moverla.</p>
      <FaqForm action={createFaq} submitLabel="Crear pregunta" />
    </section>
  );
}
