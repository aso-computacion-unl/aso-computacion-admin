import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";
import { deletePillar, movePillar, setPillarPublished } from "@/interface/admin/pillars/actions";
import { getAdminPillars } from "@/interface/admin/pillars/pillars-admin-read";
import { publicationSummary } from "@/interface/admin/publication-summary";

import { OrderedRow } from "../_components/ordered-row";
import { PageHead } from "../_components/page-head";
import { DeleteButton, MoveButtons, PublishedToggle } from "../_components/row-actions";
import { EmptyState, OrderedList } from "../_components/timeline-parts";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminPillarsPage() {
  const pillars = await getAdminPillars();

  return (
    <div>
      <PageHead
        title="Pilares"
        meta={`main · ${publicationSummary(pillars)}`}
        action={
          <Button asChild className="min-h-12 flex-none">
            <Link href="/admin/pillars/new">
              <Icon name="plus" />
              Nuevo pilar
            </Link>
          </Button>
        }
      />
      {pillars.length === 0 ? (
        <EmptyState
          action={
            <Button asChild>
              <Link href="/admin/pillars/new">
                <Icon name="plus" />
                Crear el primer pilar
              </Link>
            </Button>
          }
        >
          Todavía no hay pilares. Cada pilar es una palabra, un título y un texto corto, con imagen opcional.
        </EmptyState>
      ) : (
        <OrderedList label="Pilares, en el orden en que se muestran">
          {pillars.map((pillar, index) => (
            <OrderedRow
              key={pillar.id}
              published={pillar.isPublished}
              position={index + 1}
              label={pillar.title}
              editHref={`/admin/pillars/${pillar.id}/edit`}
              media={
                pillar.image ? (
                  // Remote Cloudinary asset, requested at thumbnail size; a plain <img> is enough in the admin.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailUrl(pillar.image.url, 96, 72)} alt="" loading="lazy" decoding="async" width={96} height={72} className="aspect-4/3 w-20 shrink-0 rounded-xs object-cover sm:w-24" />
                ) : null
              }
              toggle={<PublishedToggle label={pillar.title} isPublished={pillar.isPublished} action={setPillarPublished.bind(null, pillar.id)} />}
              move={
                <MoveButtons
                  label={pillar.title}
                  isFirst={index === 0}
                  isLast={index === pillars.length - 1}
                  position={index + 1}
                  total={pillars.length}
                  action={movePillar.bind(null, pillar.id)}
                />
              }
              remove={
                <DeleteButton label={pillar.title} warning="¿Eliminar este pilar y su imagen?" action={deletePillar.bind(null, pillar.id)} />
              }
            >
              <p className="font-mono text-xs font-semibold tracking-[0.04em] text-sky uppercase">{pillar.word}</p>
              <h2 className="font-display text-lg leading-tight wrap-anywhere">
                <Link href={`/admin/pillars/${pillar.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                  {pillar.title}
                </Link>
              </h2>
              <p className="line-clamp-2 text-sm text-mist">{pillar.image ? pillar.text : `${pillar.text} · Sin imagen`}</p>
            </OrderedRow>
          ))}
        </OrderedList>
      )}
    </div>
  );
}
