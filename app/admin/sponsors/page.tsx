import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";
import { moveSponsor, setSponsorPublished, trashSponsor } from "@/interface/admin/sponsors/actions";
import { getAdminSponsors } from "@/interface/admin/sponsors/sponsors-admin-read";
import { publicationSummary } from "@/interface/admin/publication-summary";
import { restoreTrashed } from "@/interface/admin/trash/actions";

import { BulkSelection } from "../_components/bulk-selection";
import { OrderedRow } from "../_components/ordered-row";
import { PageHead } from "../_components/page-head";
import { ReorderableList } from "../_components/reorderable-list";
import { MoveButtons, PublishedToggle, TrashButton } from "../_components/row-actions";
import { EmptyState } from "../_components/empty-state";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminSponsorsPage() {
  const sponsors = await getAdminSponsors();

  return (
    <div>
      <PageHead
        title="Aliados"
        meta={`main · ${publicationSummary(sponsors)}`}
        action={
          <Button asChild className="min-h-12 flex-none">
            <Link href="/admin/sponsors/new">
              <Icon name="plus" />
              Nuevo aliado
            </Link>
          </Button>
        }
      />
      {sponsors.length === 0 ? (
        <EmptyState icon="image"
          action={
            <Button asChild>
              <Link href="/admin/sponsors/new">
                <Icon name="plus" />
                Agregar el primer aliado
              </Link>
            </Button>
          }
        >
          Todavía no hay aliados. Cada uno lleva nombre, logo y, si quiere, un enlace a su sitio.
        </EmptyState>
      ) : (
        <BulkSelection kind="sponsor" items={sponsors.map((sponsor) => ({ id: sponsor.id, label: sponsor.name }))}>
          <ReorderableList kind="sponsor" items={sponsors.map((sponsor) => ({ id: sponsor.id, label: sponsor.name }))} offset={0} total={sponsors.length} enabled={true} label="Aliados y patrocinadores, en el orden en que se muestran">
          {sponsors.map((sponsor, index) => (
            <OrderedRow
              key={sponsor.id}
              id={sponsor.id}
              published={sponsor.isPublished}
              position={index + 1}
              label={sponsor.name}
              editHref={`/admin/sponsors/${sponsor.id}/edit`}
              media={
                sponsor.logo ? (
                  // Remote Cloudinary asset, requested at thumbnail size; a plain <img> is enough in the admin.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailUrl(sponsor.logo.url, 64, 64)} alt="" loading="lazy" decoding="async" width={64} height={64} className="size-16 shrink-0 rounded-sm bg-foreground/5 object-contain p-1" />
                ) : (
                  <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-sm border border-dashed border-mist/60 text-mist">
                    <Icon name="image" />
                  </span>
                )
              }
              toggle={<PublishedToggle label={sponsor.name} isPublished={sponsor.isPublished} action={setSponsorPublished.bind(null, sponsor.id)} />}
              move={
                <MoveButtons
                  label={sponsor.name}
                  isFirst={index === 0}
                  isLast={index === sponsors.length - 1}
                  position={index + 1}
                  total={sponsors.length}
                  action={moveSponsor.bind(null, sponsor.id)}
                />
              }
              remove={<TrashButton label={sponsor.name} warning="¿Mover a este aliado a la papelera?" action={trashSponsor.bind(null, sponsor.id)} undo={restoreTrashed.bind(null, "sponsor", sponsor.id)} />}
            >
              <h2 className="font-display text-lg leading-tight wrap-anywhere">
                <Link href={`/admin/sponsors/${sponsor.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                  {sponsor.name}
                </Link>
              </h2>
              <p className="text-sm text-mist wrap-anywhere">{sponsor.url ?? "Sin enlace"}</p>
              {sponsor.logo ? null : <p className="font-mono text-xs text-mist">Sin logo: no se puede publicar</p>}
            </OrderedRow>
          ))}
        </ReorderableList>
        </BulkSelection>
      )}
    </div>
  );
}
