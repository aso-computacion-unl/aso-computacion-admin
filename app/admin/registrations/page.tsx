import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getAdminEventRegistrations } from "@/interface/admin/event-registrations/registrations-admin-read";
import { getAdminRegistrationOverview } from "@/interface/admin/event-registrations/registrations-overview-admin-read";
import { pluralize } from "@/interface/admin/publication-summary";
import { cn } from "@/lib/utils";

import { EmptyState } from "../_components/empty-state";
import { PageFrame } from "../_components/form-layout";
import { PageHeader } from "../_components/page-header";
import { EventList } from "./_components/event-list";
import { PeoplePane } from "./_components/people-pane";
import { defaultEvent } from "./_components/registration-format";

// Counts and personal data that change with every registration: never prerendered.
export const dynamic = "force-dynamic";

// Below `xl` the two panes are two screens: the events first, the people once one is chosen.
const ONLY_ON_WIDE = "max-xl:hidden";

export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<{ evento?: string | string[] }> }) {
  const { evento } = await searchParams;
  const { upcoming, past } = await getAdminRegistrationOverview();
  const rows = [...upcoming, ...past];
  const registered = rows.reduce((total, row) => total + row.registered, 0);
  // An id that is not in the list (a stale link, an event that stopped taking registrations) is the same as none.
  const chosen = typeof evento === "string" ? rows.find((row) => row.id === evento) : undefined;
  const selected = chosen ?? defaultEvent(upcoming, past);
  const page = selected ? await getAdminEventRegistrations(selected.id) : null;

  return (
    <PageFrame>
      <PageHeader title="Inscripciones" status={`${pluralize(rows.length, "evento", "eventos")} · ${pluralize(registered, "inscrito", "inscritos")}`} />

      {rows.length === 0 ? (
        <EmptyState
          icon="events"
          action={
            <Button asChild variant="line">
              <Link href="/admin/events">Ir a los eventos</Link>
            </Button>
          }
        >
          Ningún evento pide inscripción todavía. Elija una forma de inscripción al editar un evento.
        </EmptyState>
      ) : (
        <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start">
          <div data-pane="events" className={cn(chosen && ONLY_ON_WIDE)}>
            <EventList upcoming={upcoming} past={past} selectedId={selected?.id} />
          </div>
          <div data-pane="people" className={cn(!chosen && ONLY_ON_WIDE)}>
            {selected && page ? <PeoplePane row={selected} page={page} /> : null}
          </div>
        </div>
      )}
    </PageFrame>
  );
}
