import Link from "next/link";

import { deleteSocialLink, moveSocialLink, setSocialLinkPublished } from "@/interface/admin/socials/actions";
import { getAdminSocialLinks } from "@/interface/admin/socials/socials-admin-read";

import { DeleteButton, MoveButtons, PublishedToggle } from "../_components/row-actions";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminSocialLinksPage() {
  const links = await getAdminSocialLinks();

  return (
    <section>
      <h1>Redes sociales</h1>
      <p>
        <Link href="/admin/socials/new">Agregar red</Link>
      </p>
      {links.length === 0 ? (
        <p role="status">Todavía no hay redes. Agregue la primera con «Agregar red».</p>
      ) : (
        <table>
          <caption className="visually-hidden">Redes sociales, en el orden en que se muestran</caption>
          <thead>
            <tr>
              <th scope="col">Red</th>
              <th scope="col">Usuario</th>
              <th scope="col">Estado</th>
              <th scope="col">Orden</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link, index) => (
              <tr key={link.id}>
                <th scope="row">
                  <Link href={`/admin/socials/${link.id}/edit`}>{link.label}</Link>
                </th>
                <td>{link.handle}</td>
                <td>
                  <PublishedToggle
                    label={link.label}
                    isPublished={link.isPublished}
                    action={setSocialLinkPublished.bind(null, link.id)}
                  />
                </td>
                <td>
                  <MoveButtons
                    label={link.label}
                    isFirst={index === 0}
                    isLast={index === links.length - 1}
                    action={moveSocialLink.bind(null, link.id)}
                  />
                </td>
                <td>
                  <DeleteButton label={link.label} warning="¿Eliminar esta red?" action={deleteSocialLink.bind(null, link.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
