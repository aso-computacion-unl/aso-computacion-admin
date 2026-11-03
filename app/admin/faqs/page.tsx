import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { trashFaq, moveFaq, setFaqPublished } from "@/interface/admin/faqs/actions";
import { getAdminFaqs } from "@/interface/admin/faqs/faqs-admin-read";
import { publicationSummary } from "@/interface/admin/publication-summary";
import { restoreTrashed } from "@/interface/admin/trash/actions";

import { OrderedRow } from "../_components/ordered-row";
import { PageHead } from "../_components/page-head";
import { DeleteButton, MoveButtons, PublishedToggle } from "../_components/row-actions";
import { EmptyState, OrderedList } from "../_components/timeline-parts";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminFaqsPage() {
  const faqs = await getAdminFaqs();

  return (
    <div>
      <PageHead
        title="Preguntas frecuentes"
        meta={`main · ${publicationSummary(faqs)}`}
        action={
          <Button asChild className="min-h-12 flex-none">
            <Link href="/admin/faqs/new">
              <Icon name="plus" />
              Nueva pregunta
            </Link>
          </Button>
        }
      />
      {faqs.length === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link href="/admin/faqs/new">
                <Icon name="plus" />
                Crear la primera pregunta
              </Link>
            </Button>
          }
        >
          Todavía no hay preguntas. Las respuestas aparecen en el sitio en el orden de esta lista.
        </EmptyState>
      ) : (
        <OrderedList label="Preguntas frecuentes, en el orden en que se muestran">
          {faqs.map((faq, index) => (
            <OrderedRow
              key={faq.id}
              published={faq.isPublished}
              position={index + 1}
              label={faq.question}
              editHref={`/admin/faqs/${faq.id}/edit`}
              toggle={<PublishedToggle label={faq.question} isPublished={faq.isPublished} action={setFaqPublished.bind(null, faq.id)} />}
              move={
                <MoveButtons
                  label={faq.question}
                  isFirst={index === 0}
                  isLast={index === faqs.length - 1}
                  position={index + 1}
                  total={faqs.length}
                  action={moveFaq.bind(null, faq.id)}
                />
              }
              remove={<DeleteButton label={faq.question} warning="¿Mover esta pregunta a la papelera?" action={trashFaq.bind(null, faq.id)} undo={restoreTrashed.bind(null, "faq", faq.id)} />}
            >
              <h2 className="text-base leading-snug font-bold font-stretch-[108%] wrap-anywhere">
                <Link href={`/admin/faqs/${faq.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                  {faq.question}
                </Link>
              </h2>
              {faq.command ? <p className="font-mono text-[0.8125rem] text-sky">❯ git help {faq.command}</p> : null}
              <p className="line-clamp-2 text-sm text-mist">{faq.answer}</p>
            </OrderedRow>
          ))}
        </OrderedList>
      )}
    </div>
  );
}
