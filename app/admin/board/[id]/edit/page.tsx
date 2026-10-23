import { notFound } from "next/navigation";

import { updateBoardMember } from "@/interface/admin/board/actions";
import { getAdminBoardMember } from "@/interface/admin/board/board-members-admin-read";

import { FormPage, Panel } from "../../../_components/page-head";
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
    <FormPage
      backHref="/admin/board"
      backLabel="Volver a la directiva"
      title="Editar integrante"
      aside={<BoardMemberPhotoPanel key={member.photo?.url ?? "no-photo"} memberId={id} photo={member.photo} />}
    >
      {/* Keyed by the photo so the alt field and the panel start fresh after a replace or remove. */}
      <Panel>
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
      </Panel>
    </FormPage>
  );
}
