import Link from "next/link";

import { deleteBoardMember, moveBoardMember, setBoardMemberPublished } from "@/interface/admin/board/actions";
import { getAdminBoardMembers } from "@/interface/admin/board/board-members-admin-read";

import { DeleteButton, MoveButtons, PublishedToggle } from "../_components/row-actions";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminBoardPage() {
  const members = await getAdminBoardMembers();

  return (
    <section>
      <h1>Directiva</h1>
      <p>
        <Link href="/admin/board/new">Agregar integrante</Link>
      </p>
      {members.length === 0 ? (
        <p role="status">Todavía no hay integrantes. Agregue el primero con «Agregar integrante».</p>
      ) : (
        <table>
          <caption className="visually-hidden">Integrantes de la directiva, en el orden en que se muestran</caption>
          <thead>
            <tr>
              <th scope="col">Integrante</th>
              <th scope="col">Foto</th>
              <th scope="col">Estado</th>
              <th scope="col">Orden</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, index) => (
              <tr key={member.id}>
                <th scope="row">
                  <Link href={`/admin/board/${member.id}/edit`}>
                    {member.name} · {member.role}
                  </Link>
                </th>
                <td>{member.photo ? "Con foto" : "Sin foto"}</td>
                <td>
                  <PublishedToggle
                    label={member.name}
                    isPublished={member.isPublished}
                    action={setBoardMemberPublished.bind(null, member.id)}
                  />
                </td>
                <td>
                  <MoveButtons
                    label={member.name}
                    isFirst={index === 0}
                    isLast={index === members.length - 1}
                    action={moveBoardMember.bind(null, member.id)}
                  />
                </td>
                <td>
                  <DeleteButton
                    label={member.name}
                    warning="¿Eliminar a este integrante y su foto?"
                    action={deleteBoardMember.bind(null, member.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
