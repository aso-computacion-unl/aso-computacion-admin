import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";
import { formatEventDate } from "@/interface/admin/events/event-timeline";
import { trashNewsItem, setNewsItemPublished } from "@/interface/admin/news/actions";
import { getAdminNewsCounts, getAdminNewsPage } from "@/interface/admin/news/news-admin-read";
import { countsSummary } from "@/interface/admin/publication-summary";
import { windowBadge } from "@/interface/admin/publication-window-badge";
import { listCriteria, parseListParams } from "@/interface/admin/list-params";
import { parseStatusFilter } from "@/interface/admin/status-filter";
import { restoreTrashed } from "@/interface/admin/trash/actions";

import { PageHeader } from "../_components/page-header";
import { TrashButton, PublishedToggle } from "../_components/row-actions";
import { BulkCheckbox, BulkSelection } from "../_components/bulk-selection";
import { ListSearch } from "../_components/list-search";
import { Pager } from "../_components/pager";
import { FilterEmpty, StatusFilter } from "../_components/status-filter";
import { EmptyState } from "../_components/empty-state";
import { OrderedList, Stamp, TimelineItem } from "../_components/timeline-parts";
import { WindowBadge } from "../_components/window-badge";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const LIST_PATH = "/admin/news";

export default async function AdminNewsPage({ searchParams }: { searchParams: Promise<{ estado?: string | string[]; q?: string | string[]; pagina?: string | string[] }> }) {
  const params = await searchParams;
  const filter = parseStatusFilter(params.estado);
  const { search, page: requestedPage } = parseListParams(params);
  const [page, counts] = await Promise.all([getAdminNewsPage(listCriteria(filter, search), requestedPage), getAdminNewsCounts()]);
  const news = page.items;
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Novedades"
        status={`main · ${countsSummary(counts)}`}
        action={
          <Button asChild>
            <Link href="/admin/news/new">
              <Icon name="plus" />
              Nueva noticia
            </Link>
          </Button>
        }
      />
      {counts.published + counts.draft === 0 ? (
        <EmptyState icon="news"
          action={
            <Button asChild>
              <Link href="/admin/news/new">
                <Icon name="plus" />
                Escribir la primera noticia
              </Link>
            </Button>
          }
        >
          Todavía no hay novedades. Cada noticia lleva título, resumen, texto y, si quiere, una foto de portada.
        </EmptyState>
      ) : (
        <>
          <StatusFilter path={LIST_PATH} current={filter} counts={counts} search={search} />
          <ListSearch path={LIST_PATH} filter={filter} search={search} label="novedades" />
          {news.length === 0 ? <FilterEmpty path={LIST_PATH} filter={filter} noun="novedades" search={search} /> : null}
          {news.length > 0 ? (
            <BulkSelection kind="news" items={news.map((item) => ({ id: item.id, label: item.title }))}>
              <OrderedList label="Novedades, de la más reciente a la más antigua">
                {news.map((item) => (
                  <TimelineItem key={item.id} published={item.isPublished} lane="trunk">
                    <div className="grid gap-2.5 p-4 md:px-5 lg:grid-cols-[7.5rem_minmax(0,1fr)_auto] lg:items-center lg:gap-x-6 lg:py-3.5">
                      <div className="flex items-center gap-2">
                        <BulkCheckbox id={item.id} label={item.title} />
                        <Stamp>{formatEventDate(item.publishedAt)}</Stamp>
                      </div>
                      <div className="flex min-w-0 items-start gap-4 lg:items-center">
                        {item.cover ? (
                          // Remote Cloudinary asset, requested at thumbnail size; a plain <img> is enough in the admin.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumbnailUrl(item.cover.url, 96, 72)} alt="" loading="lazy" decoding="async" width={96} height={72} className="aspect-4/3 w-20 shrink-0 rounded-xs object-cover sm:w-24" />
                        ) : null}
                        <div className="grid min-w-0 flex-1 gap-1">
                          <h2 className="font-display text-lg leading-tight wrap-anywhere">
                            <Link href={`/admin/news/${item.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                              {item.title}
                            </Link>
                          </h2>
                          <p className="line-clamp-2 text-sm text-mist">{item.summary}</p>
                          {item.isPublished ? <WindowBadge badge={windowBadge(item, now)} /> : <p className="font-mono text-xs text-mist">Borrador: solo lo ve la directiva</p>}
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 lg:mt-0 lg:w-96 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
                        <PublishedToggle label={item.title} isPublished={item.isPublished} action={setNewsItemPublished.bind(null, item.id)} />
                        <Button asChild variant="line" size="sm" className="ml-auto">
                          <Link href={`/admin/news/${item.id}/edit`} aria-label={`Editar: ${item.title}`}>
                            <Icon name="edit" className="size-4" />
                            Editar
                          </Link>
                        </Button>
                        <TrashButton label={item.title} warning="¿Mover esta noticia a la papelera?" action={trashNewsItem.bind(null, item.id)} undo={restoreTrashed.bind(null, "news", item.id)} />
                      </div>
                    </div>
                  </TimelineItem>
                ))}
              </OrderedList>
            </BulkSelection>
          ) : null}
          <Pager path={LIST_PATH} filter={filter} search={search} page={page} />
        </>
      )}
    </div>
  );
}
