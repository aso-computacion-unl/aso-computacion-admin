import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { trashFaq, moveFaq, setFaqPublished } from "@/interface/admin/faqs/actions";
import { getAdminFaqsCounts, getAdminFaqsPage } from "@/interface/admin/faqs/faqs-admin-read";
import { listCriteria, parseListParams, showListTools } from "@/interface/admin/list-params";
import { countsSummary } from "@/interface/admin/publication-summary";
import { restoreTrashed } from "@/interface/admin/trash/actions";

import { ListSearch } from "../_components/list-search";
import { BulkSelection } from "../_components/bulk-selection";
import { AddRow } from "../_components/list-row";
import { OrderedRow } from "../_components/ordered-row";
import { AreaTabs } from "../_components/area-tabs";
import { PageHeader } from "../_components/page-header";
import { ReorderableList } from "../_components/reorderable-list";
import { Pager } from "../_components/pager";
import { TrashButton, MoveButtons, PublishedToggle } from "../_components/row-actions";
import { FilterEmpty } from "../_components/status-filter";
import { EmptyState } from "../_components/empty-state";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const LIST_PATH = "/admin/faqs";

export default async function AdminFaqsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; pagina?: string | string[] }> }) {
  const params = await searchParams;
  const { search, page: requestedPage } = parseListParams(params);
  const [page, counts] = await Promise.all([getAdminFaqsPage(listCriteria("todos", search), requestedPage), getAdminFaqsCounts()]);
  const faqs = page.items;
  // A place in the whole list is only known while it is shown whole: a search hides neighbours, so it hides positions and moves too.
  const searching = search !== "";
  const offset = (page.page - 1) * page.pageSize;
  // `counts` are the whole list's, whatever the search; the page's own total is the match count.
  const listTotal = counts.published + counts.draft;
  const tools = showListTools(listTotal, { search });

  return (
    <div>
      <AreaTabs area="contenido" current="/admin/faqs" />
      <PageHeader
        title="Preguntas frecuentes"
        status={`main · ${countsSummary(counts)}`}
      />
      {listTotal === 0 ? (
        <EmptyState
          icon="faq"
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
        <>
          {tools ? <ListSearch path={LIST_PATH} filter="todos" search={search} label="preguntas" /> : null}
          {faqs.length === 0 ? <FilterEmpty path={LIST_PATH} filter="todos" noun="preguntas" search={search} /> : null}
          {faqs.length > 0 ? (
            <BulkSelection kind="faq" enabled={tools} items={faqs.map((faq) => ({ id: faq.id, label: faq.question }))}>
              <ReorderableList kind="faq" items={faqs.map((faq) => ({ id: faq.id, label: faq.question }))} offset={offset} total={page.total} enabled={!searching} label="Preguntas frecuentes, en el orden en que se muestran">
                {faqs.map((faq, index) => (
                  <OrderedRow
                    key={faq.id}
                    id={faq.id}
                    published={faq.isPublished}
                    position={searching ? null : offset + index + 1}
                    label={faq.question}
                    editHref={`/admin/faqs/${faq.id}/edit`}
                    toggle={<PublishedToggle label={faq.question} isPublished={faq.isPublished} action={setFaqPublished.bind(null, faq.id)} />}
                    move={
                      searching ? undefined : (
                        <MoveButtons
                          label={faq.question}
                          isFirst={offset + index === 0}
                          isLast={offset + index === page.total - 1}
                          position={offset + index + 1}
                          total={page.total}
                          action={moveFaq.bind(null, faq.id)}
                        />
                      )
                    }
                    remove={<TrashButton label={faq.question} warning="¿Mover esta pregunta a la papelera?" action={trashFaq.bind(null, faq.id)} undo={restoreTrashed.bind(null, "faq", faq.id)} />}
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
              </ReorderableList>
              {tools ? null : <AddRow href="/admin/faqs/new">Agregar pregunta</AddRow>}
            </BulkSelection>
          ) : null}
          <Pager path={LIST_PATH} filter="todos" search={search} page={page} />
        </>
      )}
    </div>
  );
}
