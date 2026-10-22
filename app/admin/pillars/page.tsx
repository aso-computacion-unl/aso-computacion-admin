import Link from "next/link";

import { deletePillar, movePillar, setPillarPublished } from "@/interface/admin/pillars/actions";
import { getAdminPillars } from "@/interface/admin/pillars/pillars-admin-read";

import { DeleteButton, MoveButtons, PublishedToggle } from "../_components/row-actions";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminPillarsPage() {
  const pillars = await getAdminPillars();

  return (
    <section>
      <h1>Pilares</h1>
      <p>
        <Link href="/admin/pillars/new">Crear pilar</Link>
      </p>
      {pillars.length === 0 ? (
        <p role="status">Todavía no hay pilares. Cree el primero con «Crear pilar».</p>
      ) : (
        <table>
          <caption className="visually-hidden">Pilares, en el orden en que se muestran</caption>
          <thead>
            <tr>
              <th scope="col">Pilar</th>
              <th scope="col">Imagen</th>
              <th scope="col">Estado</th>
              <th scope="col">Orden</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pillars.map((pillar, index) => (
              <tr key={pillar.id}>
                <th scope="row">
                  <Link href={`/admin/pillars/${pillar.id}/edit`}>
                    {pillar.word} · {pillar.title}
                  </Link>
                </th>
                <td>{pillar.image ? "Con imagen" : "Sin imagen"}</td>
                <td>
                  <PublishedToggle
                    label={pillar.title}
                    isPublished={pillar.isPublished}
                    action={setPillarPublished.bind(null, pillar.id)}
                  />
                </td>
                <td>
                  <MoveButtons
                    label={pillar.title}
                    isFirst={index === 0}
                    isLast={index === pillars.length - 1}
                    action={movePillar.bind(null, pillar.id)}
                  />
                </td>
                <td>
                  <DeleteButton
                    label={pillar.title}
                    warning="¿Eliminar este pilar y su imagen?"
                    action={deletePillar.bind(null, pillar.id)}
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
