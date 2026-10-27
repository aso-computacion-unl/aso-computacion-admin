import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { trashCommand, moveCommand, setCommandPublished } from "@/interface/admin/commands/actions";
import { getAdminCommandsCounts, getAdminCommandsPage } from "@/interface/admin/commands/commands-admin-read";
import { listCriteria, parseListParams } from "@/interface/admin/list-params";
import { countsSummary } from "@/interface/admin/publication-summary";
import { restoreTrashed } from "@/interface/admin/trash/actions";

import { ListSearch } from "../_components/list-search";
import { BulkSelection } from "../_components/bulk-selection";
import { OrderedRow } from "../_components/ordered-row";
import { PageHead } from "../_components/page-head";
import { Pager } from "../_components/pager";
import { TrashButton, MoveButtons, PublishedToggle } from "../_components/row-actions";
import { FilterEmpty } from "../_components/status-filter";
import { EmptyState, OrderedList } from "../_components/timeline-parts";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const LIST_PATH = "/admin/commands";

export default async function AdminCommandsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; pagina?: string | string[] }> }) {
  const params = await searchParams;
  const { search, page: requestedPage } = parseListParams(params);
  const [page, counts] = await Promise.all([getAdminCommandsPage(listCriteria("todos", search), requestedPage), getAdminCommandsCounts()]);
  const commands = page.items;
  // A place in the whole list is only known while it is shown whole: a search hides neighbours, so it hides positions and moves too.
  const searching = search !== "";
  const offset = (page.page - 1) * page.pageSize;
  // `counts` are the whole list's, whatever the search; the page's own total is the match count.
  const listTotal = counts.published + counts.draft;

  return (
    <div>
      <PageHead
        title="Comandos"
        meta={`main · ${countsSummary(counts)}`}
        action={
          <Button asChild className="min-h-12 flex-none">
            <Link href="/admin/commands/new">
              <Icon name="plus" />
              Nuevo comando
            </Link>
          </Button>
        }
      />
      {listTotal === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link href="/admin/commands/new">
                <Icon name="plus" />
                Crear el primer comando
              </Link>
            </Button>
          }
        >
          Todavía no hay comandos. Los comandos publicados aparecen en la ayuda del terminal en el orden de esta lista.
        </EmptyState>
      ) : (
        <>
          <ListSearch path={LIST_PATH} filter="todos" search={search} label="comandos" />
          {commands.length === 0 ? <FilterEmpty path={LIST_PATH} filter="todos" noun="comandos" search={search} /> : null}
          {commands.length > 0 ? (
            <BulkSelection kind="command" items={commands.map((item) => ({ id: item.id, label: item.command }))}>
              <OrderedList label="Comandos, en el orden en que se muestran">
                {commands.map((item, index) => (
                  <OrderedRow
                    key={item.id}
                    id={item.id}
                    published={item.isPublished}
                    position={searching ? null : offset + index + 1}
                    label={item.command}
                    editHref={`/admin/commands/${item.id}/edit`}
                    toggle={<PublishedToggle label={item.command} isPublished={item.isPublished} action={setCommandPublished.bind(null, item.id)} />}
                    move={
                      searching ? undefined : (
                        <MoveButtons
                          label={item.command}
                          isFirst={offset + index === 0}
                          isLast={offset + index === page.total - 1}
                          position={offset + index + 1}
                          total={page.total}
                          action={moveCommand.bind(null, item.id)}
                        />
                      )
                    }
                    remove={<TrashButton label={item.command} warning="¿Mover este comando a la papelera?" action={trashCommand.bind(null, item.id)} undo={restoreTrashed.bind(null, "command", item.id)} />}
                  >
                    <h2 className="text-base leading-snug font-bold font-stretch-[108%] wrap-anywhere">
                      <Link href={`/admin/commands/${item.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                        ❯ {item.command}
                      </Link>
                    </h2>
                    <p className="line-clamp-2 text-sm text-mist">{item.description}</p>
                  </OrderedRow>
                ))}
              </OrderedList>
            </BulkSelection>
          ) : null}
          <Pager path={LIST_PATH} filter="todos" search={search} page={page} />
        </>
      )}
    </div>
  );
}
