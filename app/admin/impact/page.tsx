import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { moveImpactStat, setImpactStatPublished, trashImpactStat } from "@/interface/admin/impact/actions";
import { getAdminImpactStats } from "@/interface/admin/impact/impact-admin-read";
import { publicationSummary } from "@/interface/admin/publication-summary";
import { restoreTrashed } from "@/interface/admin/trash/actions";
import { showListTools } from "@/interface/admin/list-params";

import { BulkSelection } from "../_components/bulk-selection";
import { AddRow } from "../_components/list-row";
import { OrderedRow } from "../_components/ordered-row";
import { PageHeader } from "../_components/page-header";
import { ReorderableList } from "../_components/reorderable-list";
import { MoveButtons, PublishedToggle, TrashButton } from "../_components/row-actions";
import { EmptyState } from "../_components/empty-state";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminImpactPage() {
  const stats = await getAdminImpactStats();
  const tools = showListTools(stats.length);

  return (
    <div>
      <PageHeader
        title="Impacto"
        status={`main · ${publicationSummary(stats)}`}
        action={
          <Button asChild>
            <Link href="/admin/impact/new">
              <Icon name="plus" />
              Nueva cifra
            </Link>
          </Button>
        }
      />
      {stats.length === 0 ? (
        <EmptyState
          icon="star"
          action={
            <Button asChild>
              <Link href="/admin/impact/new">
                <Icon name="plus" />
                Crear la primera cifra
              </Link>
            </Button>
          }
        >
          Todavía no hay cifras de impacto. Cada una lleva un número y lo que cuenta, por ejemplo «120+ · Estudiantes en la comunidad».
        </EmptyState>
      ) : (
        <BulkSelection kind="impact" enabled={tools} items={stats.map((stat) => ({ id: stat.id, label: `${stat.value} ${stat.label}` }))}>
          <ReorderableList kind="impact" items={stats.map((stat) => ({ id: stat.id, label: `${stat.value} ${stat.label}` }))} offset={0} total={stats.length} enabled={true} label="Cifras de impacto, en el orden en que se muestran">
          {stats.map((stat, index) => {
            const name = `${stat.value} ${stat.label}`;

            return (
              <OrderedRow
                key={stat.id}
                id={stat.id}
                published={stat.isPublished}
                position={index + 1}
                label={name}
                editHref={`/admin/impact/${stat.id}/edit`}
                toggle={<PublishedToggle label={name} isPublished={stat.isPublished} action={setImpactStatPublished.bind(null, stat.id)} />}
                move={
                  <MoveButtons
                    label={name}
                    isFirst={index === 0}
                    isLast={index === stats.length - 1}
                    position={index + 1}
                    total={stats.length}
                    action={moveImpactStat.bind(null, stat.id)}
                  />
                }
                remove={<TrashButton label={name} warning="¿Mover esta cifra a la papelera?" action={trashImpactStat.bind(null, stat.id)} undo={restoreTrashed.bind(null, "impact", stat.id)} />}
              >
                <h2 className="font-display text-lg leading-tight wrap-anywhere">
                  <Link href={`/admin/impact/${stat.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                    {stat.value}
                  </Link>
                </h2>
                <p className="text-sm text-mist">{stat.label}</p>
              </OrderedRow>
            );
          })}
        </ReorderableList>
          {tools ? null : <AddRow href="/admin/impact/new">Agregar cifra</AddRow>}
        </BulkSelection>
      )}
    </div>
  );
}
