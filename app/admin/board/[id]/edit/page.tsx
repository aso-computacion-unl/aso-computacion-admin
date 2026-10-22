import Link from "next/link";
import { notFound } from "next/navigation";

import { updateBoardMember } from "@/interface/admin/board/actions";
import { getAdminBoardMember } from "@/interface/admin/board/board-members-admin-read";

import { BoardMemberForm } from "../../_components/board-member-form";
import { BoardMemberPhotoPanel } from "../../_components/board-member-photo-panel";

export const dynamic = "force-dynamic";

interface EditBoardMemberPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBoardMemberPage({ params }: EditBoardMemberPageProps) {
  const { id } = await params;
  const member = await getAdminBoardMember(id);

  if (!member) notFound();

  return (
    <section>
      <p>
        <Link href="/admin/board">← Volver a la directiva</Link>
      </p>
      <h1>Editar integrante</h1>
      {/* Keyed by the photo so the alt field and the panel start fresh after a replace or remove. */}
      <BoardMemberForm
        key={member.photo?.url ?? "no-photo"}
        action={updateBoardMember.bind(null, id)}
        submitLabel="Guardar cambios"
        hasPhoto={member.photo !== null}
        initialValues={{
          name: member.name,
          role: member.role,
          photoAlt: member.photo?.alt ?? "",
          isPublished: member.isPublished,
        }}
      />
      <BoardMemberPhotoPanel key={member.photo?.url ?? "no-photo"} memberId={id} photo={member.photo} />
    </section>
  );
}
