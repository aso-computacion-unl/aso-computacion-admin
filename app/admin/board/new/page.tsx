import { createBoardMember } from "@/interface/admin/board/actions";

import { FormLayout, Panel } from "../../_components/form-layout";
import { BoardMemberForm } from "../_components/board-member-form";

export default function NewBoardMemberPage() {
  return (
    <FormLayout
      backHref="/admin/board"
      backLabel="Volver a la directiva"
      title="Agregar integrante"
      status="sin guardar"
      description="Se agrega al final de la lista. La foto se sube en el paso siguiente y es necesaria para publicar."
    >
      <Panel>
        <BoardMemberForm action={createBoardMember} submitLabel="Agregar integrante" />
      </Panel>
    </FormLayout>
  );
}
