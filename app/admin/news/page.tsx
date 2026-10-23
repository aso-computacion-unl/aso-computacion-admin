import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { formatEventDate } from "@/interface/admin/events/event-timeline";
import { deleteNewsItem, setNewsItemPublished } from "@/interface/admin/news/actions";
import { getAdminNewsItems } from "@/interface/admin/news/news-admin-read";
import { publicationSummary } from "@/interface/admin/publication-summary";

import { PageHead } from "../_components/page-head";
import { DeleteButton, PublishedToggle } from "../_components/row-actions";
import { EmptyState, OrderedList, Stamp, TimelineItem } from "../_components/timeline-parts";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const news = await getAdminNewsItems();

  return (
    <div>
      <PageHead
        title="Novedades"
        meta={`main · ${publicationSummary(news)}`}
        action={
          <Button asChild className="min-h-12 flex-none">
            <Link href="/admin/news/new">
              <Icon name="plus" />
              Nueva noticia
            </Link>
          </Button>
        }
      />
      {news.length === 0 ? (
        <EmptyState
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
        <OrderedList label="Novedades, de la más reciente a la más antigua">
          {news.map((item) => (
            <TimelineItem key={item.id} published={item.isPublished} lane="trunk">
              <div className="grid gap-2.5 p-4 md:px-5 lg:grid-cols-[7.5rem_minmax(0,1fr)_auto] lg:items-center lg:gap-x-6 lg:py-3.5">
                <div>
                  <Stamp>{formatEventDate(item.publishedAt)}</Stamp>
                </div>
                <div className="flex min-w-0 items-start gap-4 lg:items-center">
                  {item.cover ? (
                    // Remote Cloudinary asset shown as-is in the admin; no image optimisation needed.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.cover.url} alt="" width={96} height={72} className="aspect-4/3 w-20 shrink-0 rounded-xs object-cover sm:w-24" />
                  ) : null}
                  <div className="grid min-w-0 flex-1 gap-1">
                    <h2 className="font-display text-lg leading-tight wrap-anywhere">
                      <Link href={`/admin/news/${item.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                        {item.title}
                      </Link>
                    </h2>
                    <p className="line-clamp-2 text-sm text-mist">{item.summary}</p>
                    {item.isPublished ? null : <p className="font-mono text-xs text-mist">Borrador: solo lo ve la directiva</p>}
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
                  <DeleteButton label={item.title} warning="¿Eliminar esta noticia y su portada?" action={deleteNewsItem.bind(null, item.id)} />
                </div>
              </div>
            </TimelineItem>
          ))}
        </OrderedList>
      )}
    </div>
  );
}
