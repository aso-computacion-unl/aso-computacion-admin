import Link from "next/link";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { deleteBoardMember, moveBoardMember, setBoardMemberPublished } from "@/interface/admin/board/actions";
import { getAdminBoardMembers } from "@/interface/admin/board/board-members-admin-read";
import { publicationSummary } from "@/interface/admin/publication-summary";

import { OrderedRow } from "../_components/ordered-row";
import { PageHead } from "../_components/page-head";
import { DeleteButton, MoveButtons, PublishedToggle } from "../_components/row-actions";
import { EmptyState, OrderedList } from "../_components/timeline-parts";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminBoardPage() {
  const members = await getAdminBoardMembers();

  return (
    <div>
      <PageHead
        title="Directiva"
        meta={`main · ${publicationSummary(members)}`}
        action={
          <Button asChild className="min-h-12 flex-none">
            <Link href="/admin/board/new">
              <Icon name="plus" />
              Agregar integrante
            </Link>
          </Button>
        }
      />
      {members.length === 0 ? (
        <EmptyState
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
        <OrderedList label="Integrantes de la directiva, en el orden en que se muestran">
          {members.map((member, index) => (
            <OrderedRow
              key={member.id}
              published={member.isPublished}
              position={index + 1}
              label={member.name}
              editHref={`/admin/board/${member.id}/edit`}
              media={
                member.photo ? (
                  // Remote Cloudinary asset shown as-is in the admin; no image optimisation needed.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.photo.url} alt="" width={64} height={64} className="size-16 shrink-0 rounded-full object-cover" />
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
                <DeleteButton label={member.name} warning="¿Eliminar a este integrante y su foto?" action={deleteBoardMember.bind(null, member.id)} />
              }
            >
              <h2 className="font-display text-lg leading-tight wrap-anywhere">
                <Link href={`/admin/board/${member.id}/edit`} className="rounded-xs underline-offset-4 hover:underline">
                  {member.name}
                </Link>
              </h2>
              <p className="text-sm text-mist">{member.role}</p>
              {member.photo ? null : <p className="font-mono text-xs text-mist">Sin foto: no se puede publicar</p>}
            </OrderedRow>
          ))}
        </OrderedList>
      )}
    </div>
  );
}
