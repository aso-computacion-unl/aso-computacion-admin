import { createAdminInvite } from "@/interface/admin/users/actions";
import { getAdminUsers, getPendingInvites } from "@/interface/admin/users/users-admin-read";
import { ROLE_LABELS } from "@/interface/admin/role-labels";
import { pluralize } from "@/interface/admin/publication-summary";
import { requirePageSession } from "@/interface/auth/require-page-session";

import { PageHeader } from "../_components/page-header";
import { Panel } from "../_components/form-layout";
import { EmptyState } from "../_components/empty-state";
import { CreateInviteForm } from "./_components/create-invite-form";
import { RevokeInviteButton } from "./_components/revoke-invite-button";
import { UserActiveControl, UserRoleSelect } from "./_components/user-row-controls";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const EXPIRY = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "America/Guayaquil" });
const LAST_LOGIN = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

export default async function AdminUsersPage() {
  const actor = await requirePageSession("ADMIN");
  const [users, invites] = await Promise.all([getAdminUsers(), getPendingInvites()]);
  const active = users.filter((user) => user.active).length;
  const nobodyElse = users.every((user) => user.id === actor.userId);

  return (
    <div>
      <PageHeader
        title="Usuarios"
        status={`${pluralize(active, "activo", "activos")} · ${pluralize(users.length - active, "desactivado", "desactivados")}`}
        description="Solo entran al panel las personas de esta lista, con su cuenta de Google. Invite con un enlace de un solo uso, atado a su correo. Los editores editan contenido; los administradores, además, usuarios, textos del sitio y registro."
      />

      <Panel className="mt-6" aria-labelledby="invite-title">
        <h2 id="invite-title" className="mb-4 text-lg font-bold font-stretch-[112%]">
          Invitar a una persona
        </h2>
        <CreateInviteForm action={createAdminInvite} />
      </Panel>

      {invites.length > 0 ? (
        <section className="mt-6" aria-labelledby="pending-title">
          <h2 id="pending-title" className="mb-3 text-lg font-bold font-stretch-[112%]">
            Invitaciones pendientes
          </h2>
          <ul className="grid gap-3" aria-label="Invitaciones pendientes">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded bg-card p-4">
                <div className="grid min-w-0 flex-1 basis-60 gap-1">
                  <p className="font-mono text-[0.8125rem] font-semibold wrap-anywhere">{invite.email}</p>
                  <p className="font-mono text-[0.8125rem] text-mist">
                    {ROLE_LABELS[invite.role]} · vence el {EXPIRY.format(invite.expiresAt)}
                  </p>
                </div>
                <RevokeInviteButton id={invite.id} email={invite.email} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nobodyElse ? (
        <EmptyState icon="board">
          {users.length === 0 ? "Todavía nadie tiene acceso con Google." : "Por ahora solo usted tiene acceso."} Las personas que invite aparecen aquí cuando aceptan su invitación.
        </EmptyState>
      ) : null}

      <h2 className="sr-only">Usuarios con acceso</h2>

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
