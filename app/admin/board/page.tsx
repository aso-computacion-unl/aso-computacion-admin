import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { thumbnailUrl } from "@/lib/cloudinary-thumbnail";
import { trashBoardMember, moveBoardMember, setBoardMemberPublished } from "@/interface/admin/board/actions";
import { getAdminBoardMembers } from "@/interface/admin/board/board-members-admin-read";
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

export default async function AdminBoardPage() {
  const members = await getAdminBoardMembers();
  const tools = showListTools(members.length);

  return (
    <div>
      <AreaTabs area="contenido" current="/admin/board" />
      <PageHeader
        title="Directiva"
        status={`main · ${publicationSummary(members)}`}
      />
      {members.length === 0 ? (
        <EmptyState
          icon="board"
          action={
            <Button asChild>
              <Link href="/admin/board/new">
                <Icon name="plus" />
                Agregar el primer integrante
              </Link>
            </Button>
          }
        >
          Todavía no hay integrantes. Cada uno lleva solo nombre, cargo y foto; nada más se guarda.
        </EmptyState>
      ) : (
        <BulkSelection kind="board" enabled={tools} items={members.map((member) => ({ id: member.id, label: member.name }))}>
          <ReorderableList kind="board" items={members.map((member) => ({ id: member.id, label: member.name }))} offset={0} total={members.length} enabled={true} label="Integrantes de la directiva, en el orden en que se muestran">
            {members.map((member, index) => (
              <OrderedRow
                key={member.id}
                id={member.id}
                published={member.isPublished}
                position={index + 1}
                label={member.name}
                editHref={`/admin/board/${member.id}/edit`}
                media={
                  member.photo ? (
                    // Remote Cloudinary asset, requested at thumbnail size; a plain <img> is enough in the admin.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnailUrl(member.photo.url, 64, 64)} alt="" loading="lazy" decoding="async" width={64} height={64} className="size-16 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-full border border-dashed border-mist/60 text-mist">
                      <Icon name="board" />
                    </span>
                  )
                }
                toggle={<PublishedToggle label={member.name} isPublished={member.isPublished} action={setBoardMemberPublished.bind(null, member.id)} />}
                move={
                  <MoveButtons
                    label={member.name}
                    isFirst={index === 0}
                    isLast={index === members.length - 1}
                    position={index + 1}
                    total={members.length}
                    action={moveBoardMember.bind(null, member.id)}
                  />
                }
                remove={
                  <TrashButton label={member.name} warning="¿Mover a este integrante a la papelera?" action={trashBoardMember.bind(null, member.id)} undo={restoreTrashed.bind(null, "board", member.id)} />
                }
              >
                <SectionTitle className="leading-tight wrap-anywhere">
                  <Link href={`/admin/board/${member.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                    {member.name}
                  </Link>
                </SectionTitle>
                <p className="text-sm text-mist">{member.role}</p>
                {member.photo ? null : <p className="font-mono text-xs text-mist">Sin foto: no se puede publicar</p>}
              </OrderedRow>
            ))}
          </ReorderableList>
          {tools ? null : <AddRow href="/admin/board/new">Agregar integrante</AddRow>}
        </BulkSelection>
      )}
    </div>
  );
}
