import Link from "next/link";

import { createBoardMember } from "@/interface/admin/board/actions";

import { BoardMemberForm } from "../_components/board-member-form";

export default function NewBoardMemberPage() {
  return (
    <section>
      <p>
        <Link href="/admin/board">← Volver a la directiva</Link>
      </p>
      <h1>Agregar integrante</h1>
      <p>Se agrega al final de la lista. La foto se sube en el paso siguiente y es necesaria para publicar.</p>
      <BoardMemberForm action={createBoardMember} submitLabel="Agregar integrante" />
    </section>
  );
}
