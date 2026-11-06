import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";
import { formatEventDate } from "@/interface/admin/events/event-timeline";
import { trashNewsItem, setNewsItemPublished } from "@/interface/admin/news/actions";
import { getAdminNewsCounts, getAdminNewsPage } from "@/interface/admin/news/news-admin-read";
import { countsSummary } from "@/interface/admin/publication-summary";
import { windowBadge } from "@/interface/admin/publication-window-badge";
import { listCriteria, parseListParams, showListTools } from "@/interface/admin/list-params";
import { parseStatusFilter } from "@/interface/admin/status-filter";
import { restoreTrashed } from "@/interface/admin/trash/actions";

import { PageHeader } from "../_components/page-header";
import { TrashButton, PublishedToggle } from "../_components/row-actions";
import { BulkSelection } from "../_components/bulk-selection";
import { AddRow, ListRow } from "../_components/list-row";
import { ListSearch } from "../_components/list-search";
import { Pager } from "../_components/pager";
import { SectionTitle } from "../_components/section-title";
import { FilterEmpty, StatusFilter } from "../_components/status-filter";
import { EmptyState } from "../_components/empty-state";
import { OrderedList, Stamp } from "../_components/timeline-parts";
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
  const total = counts.published + counts.draft;
  const tools = showListTools(total, { search, filter });

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
        <EmptyState
          icon="news"
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
          {tools ? <ListSearch path={LIST_PATH} filter={filter} search={search} label="novedades" /> : null}
          {news.length === 0 ? <FilterEmpty path={LIST_PATH} filter={filter} noun="novedades" search={search} /> : null}
          {news.length > 0 ? (
            <BulkSelection kind="news" enabled={tools} items={news.map((item) => ({ id: item.id, label: item.title }))}>
              <OrderedList label="Novedades, de la más reciente a la más antigua">
                {news.map((item) => (
                  <ListRow
                    key={item.id}
                    id={item.id}
                    label={item.title}
                    published={item.isPublished}
                    lane="trunk"
                    lead={<Stamp>{formatEventDate(item.publishedAt)}</Stamp>}
                    media={
                      item.cover ? (
                        // Remote Cloudinary asset, requested at thumbnail size; a plain <img> is enough in the admin.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbnailUrl(item.cover.url, 96, 72)} alt="" loading="lazy" decoding="async" width={96} height={72} className="aspect-4/3 w-20 shrink-0 rounded-xs object-cover sm:w-24" />
                      ) : null
                    }
                    toggle={<PublishedToggle label={item.title} isPublished={item.isPublished} action={setNewsItemPublished.bind(null, item.id)} />}
                    editHref={`/admin/news/${item.id}/edit`}
                    remove={<TrashButton label={item.title} warning="¿Mover esta noticia a la papelera?" action={trashNewsItem.bind(null, item.id)} undo={restoreTrashed.bind(null, "news", item.id)} />}
                  >
                    <SectionTitle className="leading-tight wrap-anywhere">
                      <Link href={`/admin/news/${item.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                        {item.title}
                      </Link>
                    </SectionTitle>
                    <p className="line-clamp-2 text-sm text-mist">{item.summary}</p>
                    {item.isPublished ? <WindowBadge badge={windowBadge(item, now)} /> : <p className="font-mono text-xs text-mist">Borrador: solo lo ve la directiva</p>}
                  </ListRow>
                ))}
              </OrderedList>
              {tools ? null : <AddRow href="/admin/news/new">Agregar noticia</AddRow>}
            </BulkSelection>
          ) : null}
          <Pager path={LIST_PATH} filter={filter} search={search} page={page} />
        </>
      )}
    </div>
  );
}
