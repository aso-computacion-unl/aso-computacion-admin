import Link from "next/link";

import { deleteFaq, moveFaq, setFaqPublished } from "@/interface/admin/faqs/actions";
import { getAdminFaqs } from "@/interface/admin/faqs/faqs-admin-read";

import { DeleteButton, MoveButtons, PublishedToggle } from "../_components/row-actions";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminFaqsPage() {
  const faqs = await getAdminFaqs();

  return (
    <section>
      <h1>Preguntas frecuentes</h1>
      <p>
        <Link href="/admin/faqs/new">Crear pregunta</Link>
      </p>
      {faqs.length === 0 ? (
        <p role="status">Todavía no hay preguntas. Cree la primera con «Crear pregunta».</p>
      ) : (
        <table>
          <caption className="visually-hidden">Preguntas frecuentes, en el orden en que se muestran</caption>
          <thead>
            <tr>
              <th scope="col">Pregunta</th>
              <th scope="col">Estado</th>
              <th scope="col">Orden</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {faqs.map((faq, index) => (
              <tr key={faq.id}>
                <th scope="row">
                  <Link href={`/admin/faqs/${faq.id}/edit`}>{faq.question}</Link>
                </th>
                <td>
                  <PublishedToggle label={faq.question} isPublished={faq.isPublished} action={setFaqPublished.bind(null, faq.id)} />
                </td>
                <td>
                  <MoveButtons
                    label={faq.question}
                    isFirst={index === 0}
                    isLast={index === faqs.length - 1}
                    action={moveFaq.bind(null, faq.id)}
                  />
                </td>
                <td>
                  <DeleteButton label={faq.question} warning="¿Eliminar esta pregunta?" action={deleteFaq.bind(null, faq.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
