import { createBoardMember } from "@/interface/admin/board/actions";

import { FormPage, Panel } from "../../_components/page-head";
import { BoardMemberForm } from "../_components/board-member-form";

export default function NewBoardMemberPage() {
  return (
    <FormPage
      backHref="/admin/board"
      backLabel="Volver a la directiva"
      title="Agregar integrante"
      meta="Se agrega al final de la lista. La foto se sube en el paso siguiente y es necesaria para publicar."
    >
      <Panel>
        <BoardMemberForm action={createBoardMember} submitLabel="Agregar integrante" />
      </Panel>
    </FormPage>
  );
}
