import { inviteUser } from "@/interface/admin/users/actions";
import { getAdminUsers } from "@/interface/admin/users/users-admin-read";
import { pluralize } from "@/interface/admin/publication-summary";
import { requirePageSession } from "@/interface/auth/require-page-session";

import { PageHead, Panel } from "../_components/page-head";
import { InviteUserForm } from "./_components/invite-user-form";
import { UserActiveControl, UserRoleSelect } from "./_components/user-row-controls";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const LAST_LOGIN = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

export default async function AdminUsersPage() {
  const actor = await requirePageSession("ADMIN");
  const users = await getAdminUsers();
  const active = users.filter((user) => user.active).length;

  return (
    <div>
      <PageHead title="Usuarios" meta={`${pluralize(active, "activo", "activos")} · ${pluralize(users.length - active, "desactivado", "desactivados")}`} />
      <p className="mt-4 max-w-2xl text-mist">
        Solo entran al panel las personas de esta lista, con su cuenta de Google. Un editor crea y edita contenido; un administrador además gestiona
        usuarios, los textos del sitio y el registro de cambios, y elimina de forma definitiva.
      </p>

      <Panel className="mt-6" aria-labelledby="invite-title">
        <h2 id="invite-title" className="mb-4 text-lg font-bold font-stretch-[112%]">
          Agregar usuario
        </h2>
        <InviteUserForm action={inviteUser} />
      </Panel>

      <ul className="mt-6 grid gap-3" aria-label="Usuarios">
        {users.map((user) => (
          <li key={user.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded bg-card p-4">
            <div className="grid min-w-0 flex-1 basis-60 gap-1">
              <p className="font-bold wrap-anywhere">
                {user.name}
                {user.id === actor.userId ? <span className="ml-2 font-mono text-[0.8125rem] font-semibold text-sky">usted</span> : null}
                {user.active ? null : <span className="ml-2 font-mono text-[0.8125rem] font-semibold text-mist">desactivado</span>}
              </p>
              <p className="font-mono text-[0.8125rem] text-mist wrap-anywhere">{user.email}</p>
              <p className="font-mono text-[0.8125rem] text-mist">{user.lastLoginAt ? `Último acceso: ${LAST_LOGIN.format(user.lastLoginAt)}` : "Aún no ha entrado"}</p>
            </div>
            <div className="w-44">
              <UserRoleSelect id={user.id} name={user.name} role={user.role} />
            </div>
            <UserActiveControl id={user.id} name={user.name} active={user.active} />
          </li>
        ))}
      </ul>
    </div>
  );
}
