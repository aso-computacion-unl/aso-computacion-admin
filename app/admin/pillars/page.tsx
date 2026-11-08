import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";
import { trashPillar, movePillar, setPillarPublished } from "@/interface/admin/pillars/actions";
import { getAdminPillars } from "@/interface/admin/pillars/pillars-admin-read";
import { publicationSummary } from "@/interface/admin/publication-summary";
import { restoreTrashed } from "@/interface/admin/trash/actions";
import { showListTools } from "@/interface/admin/list-params";

import { BulkSelection } from "../_components/bulk-selection";
import { AddRow } from "../_components/list-row";
import { OrderedRow } from "../_components/ordered-row";
import { AreaTabs } from "../_components/area-tabs";
import { PageHeader } from "../_components/page-header";
import { ReorderableList } from "../_components/reorderable-list";
import { TrashButton, MoveButtons, PublishedToggle } from "../_components/row-actions";
import { EmptyState } from "../_components/empty-state";
import { SectionTitle } from "../_components/section-title";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminPillarsPage() {
  const pillars = await getAdminPillars();
  const tools = showListTools(pillars.length);

  return (
    <div>
      <AreaTabs area="contenido" current="/admin/pillars" />
      <PageHeader
        title="Pilares"
        status={`main · ${publicationSummary(pillars)}`}
      />
      {pillars.length === 0 ? (
        <EmptyState
          icon="pillars"
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
        <BulkSelection kind="pillar" enabled={tools} items={pillars.map((pillar) => ({ id: pillar.id, label: pillar.title }))}>
          <ReorderableList kind="pillar" items={pillars.map((pillar) => ({ id: pillar.id, label: pillar.title }))} offset={0} total={pillars.length} enabled={true} label="Pilares, en el orden en que se muestran">
            {pillars.map((pillar, index) => (
              <OrderedRow
                key={pillar.id}
                id={pillar.id}
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
                  <TrashButton label={pillar.title} warning="¿Mover este pilar a la papelera?" action={trashPillar.bind(null, pillar.id)} undo={restoreTrashed.bind(null, "pillar", pillar.id)} />
                }
              >
                <p className="font-mono text-xs font-semibold tracking-[0.04em] text-sky uppercase">{pillar.word}</p>
                <SectionTitle className="leading-tight wrap-anywhere">
                  <Link href={`/admin/pillars/${pillar.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                    {pillar.title}
                  </Link>
                </SectionTitle>
                <p className="line-clamp-2 text-sm text-mist">{pillar.image ? pillar.text : `${pillar.text} · Sin imagen`}</p>
              </OrderedRow>
            ))}
          </ReorderableList>
          {tools ? null : <AddRow href="/admin/pillars/new">Agregar pilar</AddRow>}
        </BulkSelection>
      )}
    </div>
  );
}
