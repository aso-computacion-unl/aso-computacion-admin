import { formatStamp } from "@/interface/admin/day-groups";
import { pluralize } from "@/interface/admin/publication-summary";
import { getActiveSessions } from "@/interface/admin/sessions/sessions-admin-read";
import { groupSessionsByPerson } from "@/interface/admin/sessions/group-sessions";
import { describeUserAgent } from "@/interface/admin/sessions/user-agent";

import { AreaTabs } from "../_components/area-tabs";
import { PageHeader } from "../_components/page-header";
import { EmptyState } from "../_components/empty-state";
import { SectionTitle } from "../_components/section-title";
import { RevokeOthersButton } from "./_components/revoke-others-button";
import { RevokeSessionButton } from "./_components/revoke-session-button";

// Reads mutable data on every request.
export const dynamic = "force-dynamic";

export default async function AdminSessionsPage() {
  const { actor, sessions } = await getActiveSessions();
  const isAdmin = actor.role === "ADMIN";
  const now = new Date();

  return (
    <div>
      <AreaTabs area="ajustes" current="/admin/sesiones" role={actor.role} />
      <PageHeader
        title="Sesiones activas"
        status={pluralize(sessions.length, "sesión abierta", "sesiones abiertas")}
        description={
          isAdmin
            ? "Todas las sesiones abiertas en el panel. Al cerrar una, ese dispositivo tendrá que iniciar sesión de nuevo."
            : "Los dispositivos donde su cuenta tiene la sesión abierta. Cierre los que no reconozca."
        }
      />
      {sessions.length === 0 ? (
        <EmptyState icon="lock">No hay sesiones abiertas.</EmptyState>
      ) : (
        // People are 40 apart and their sessions 6; from xl a person's sessions read as columns (device | three dates |
        // Cerrar sesión), the dates 9rem each («18 nov 2026 15:40») so they line up across people too.
        <div className="mt-6 grid gap-10">
          {groupSessionsByPerson(sessions).map((group) => {
            const owner = group.userId === null ? "Acceso de emergencia" : (group.userName ?? "Cuenta sin nombre");
            const headingId = `sessions-${group.userId ?? "break-glass"}`;

            return (
              <section key={group.userId ?? "break-glass"} aria-labelledby={headingId} className="grid gap-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                  <SectionTitle id={headingId} className={isAdmin ? "wrap-anywhere" : "sr-only"}>
                    {owner}
                    <span className="ml-3 font-mono text-[0.8125rem] font-normal font-stretch-normal text-mist">{pluralize(group.sessions.length, "sesión", "sesiones")}</span>
                  </SectionTitle>
                  {isAdmin && (group.userEmail || group.userId === null) ? (
                    <p className="font-mono text-[0.8125rem] text-mist wrap-anywhere">{group.userId === null ? "Acceso de emergencia con contraseña" : group.userEmail}</p>
                  ) : null}
                  {group.userId !== null && group.closableOthers > 0 ? (
                    <div className="ml-auto self-center">
                      <RevokeOthersButton userId={group.userId} label={group.userName ?? "esta cuenta"} count={group.closableOthers} isOwn={group.isOwn} />
                    </div>
                  ) : null}
                </div>
                <ul className="grid gap-1.5 xl:grid-cols-[minmax(0,1fr)_repeat(3,9rem)_max-content] xl:gap-x-6" aria-labelledby={headingId}>
                  {group.sessions.map((session) => {
                    const device = describeUserAgent(session.userAgent);

                    return (
                      <li
                        key={session.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded bg-card p-4 xl:col-span-full xl:grid xl:grid-cols-subgrid xl:px-5 xl:py-3.5 xl:[&>[role=group]]:col-span-full"
                      >
                        <div className="grid min-w-0 flex-1 basis-60 gap-1 xl:contents">
                          <p className="font-bold wrap-anywhere">
                            {device}
                            {session.isCurrent ? <span className="ml-2 font-mono text-[0.8125rem] font-semibold whitespace-nowrap text-sky">esta sesión</span> : null}
                            {session.kind === "break_glass" ? <span className="ml-2 rounded-xs bg-signal px-1.5 py-0.5 font-mono text-[0.8125rem] font-semibold text-destructive-foreground">emergencia</span> : null}
                          </p>
                          <dl className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.8125rem] text-mist xl:contents">
                            {(
                              [
                                ["Última actividad", session.lastSeenAt],
                                ["Iniciada", session.createdAt],
                                ["Vence", session.expiresAt],
                              ] as const
                            ).map(([label, at]) => (
                              <div key={label} className="flex gap-1.5 whitespace-nowrap xl:grid xl:gap-0.5">
                                <dt className="xl:text-xs">{label}</dt>
                                <dd className="text-foreground tabular-nums">{formatStamp(at, now)}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                        <RevokeSessionButton sessionId={session.id} label={device} isCurrent={session.isCurrent} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
