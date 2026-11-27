import { createAdminInvite } from "@/interface/admin/users/actions";
import { getAdminUsers, getPendingInvites } from "@/interface/admin/users/users-admin-read";
import { ROLE_LABELS } from "@/interface/admin/role-labels";
import { pluralize } from "@/interface/admin/publication-summary";
import { requirePageSession } from "@/interface/auth/require-page-session";

import { AreaTabs } from "../_components/area-tabs";
import { PageHeader } from "../_components/page-header";
import { EmptyState } from "../_components/empty-state";
import { SectionTitle } from "../_components/section-title";
import { CreateInviteForm } from "./_components/create-invite-form";
import { RevokeInviteButton } from "./_components/revoke-invite-button";
import { UserActiveControl, UserRoleSelect } from "./_components/user-row-controls";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

const EXPIRY = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "America/Guayaquil" });
const LAST_LOGIN = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Guayaquil" });

/** A group of the screen: an 18px heading with its total on the same line. */
function GroupHeading({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <SectionTitle id={id}>{title}</SectionTitle>
      <span className="font-mono text-[0.8125rem] text-mist">{count}</span>
    </div>
  );
}

export default async function AdminUsersPage() {
  const actor = await requirePageSession("ADMIN");
  const [users, invites] = await Promise.all([getAdminUsers(), getPendingInvites()]);
  const active = users.filter((user) => user.active).length;
  const nobodyElse = users.every((user) => user.id === actor.userId);

  return (
    <div>
      <AreaTabs area="ajustes" current="/admin/usuarios" role="ADMIN" />
      <PageHeader
        title="Usuarios"
        status={`${pluralize(active, "activo", "activos")} · ${pluralize(users.length - active, "desactivado", "desactivados")}`}
        description="Solo entran al panel las personas de esta lista, con su cuenta de Google. Invite con un enlace de un solo uso, atado a su correo. Los editores editan contenido; los administradores, además, usuarios, textos del sitio y registro."
      />

      {/* The list fills; inviting, the one action of the screen, lives in a 22rem panel that stays in sight (below on a phone). */}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-10">
          {invites.length > 0 ? (
            <section aria-labelledby="pending-title">
              <GroupHeading id="pending-title" title="Invitaciones pendientes" count={invites.length} />
              <ul className="grid gap-1.5" aria-label="Invitaciones pendientes">
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

          <section aria-labelledby="users-title">
            <GroupHeading id="users-title" title="Usuarios con acceso" count={users.length} />
            {nobodyElse ? (
              <EmptyState icon="board">
                {users.length === 0 ? "Todavía nadie tiene acceso con Google." : "Por ahora solo usted tiene acceso."} Las personas que invite aparecen aquí cuando aceptan su invitación.
              </EmptyState>
            ) : null}
            <ul className="grid gap-1.5" aria-label="Usuarios">
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
                  {/* The select measures «Administrador», the same in every row, so the roles line up. */}
                  <UserRoleSelect id={user.id} name={user.name} role={user.role} />
                  <UserActiveControl id={user.id} name={user.name} active={user.active} />
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside aria-labelledby="invite-title" className="@container grid gap-4 rounded bg-card p-4 md:p-5 lg:sticky lg:top-22">
          <SectionTitle id="invite-title">Invitar a una persona</SectionTitle>
          <CreateInviteForm action={createAdminInvite} />
        </aside>
      </div>
    </div>
  );
}
