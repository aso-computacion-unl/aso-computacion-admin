import type { Metadata } from "next";

import { groupByMonth } from "@/interface/event-registration/registration-months";
import { getOpenRegistrationEvents } from "@/interface/forum/event-registration-read";
import { parseForumLoginError } from "@/interface/forum/forum-login-errors";
import { getForumMember } from "@/interface/forum/require-forum-member";

import { LOGIN_PROBLEM_MESSAGES } from "./_components/login-problems";
import { RegistrationCard } from "./_components/registration-card";
import { RegistrationMonths } from "./_components/registration-months";

// The layout's title template covers the pages below this segment, not the page of the segment itself.
export const metadata: Metadata = { title: { absolute: "Inscripciones — ASO Computación" } };

// Reads the live seat counts: never prerendered.
export const dynamic = "force-dynamic";

const LEAD = "Talleres, charlas y encuentros de la carrera.";

type Param = string | string[] | undefined;

/**
 * The public list of the events that take registrations right now, UNL or open form (D8), soonest first under a
 * heading per month, with a month filter once they span two months (S4, S5). It asks for no sign-in: the header offers
 * an optional UNL access (S1), and a student proves their UNL account only when they reserve, on the event's page.
 */
export default async function RegistrationsListPage({ searchParams }: { searchParams: Promise<{ error?: Param }> }) {
  const [events, member, { error }] = await Promise.all([getOpenRegistrationEvents(), getForumMember(), searchParams]);
  const signedIn = member !== null;
  // A sign-in started from the header that failed comes back here with its code (`?error=`); anything else is ignored.
  const problem = parseForumLoginError(error);
  const kicker = events.length === 0 ? "Sin inscripciones abiertas" : `${events.length} ${events.length === 1 ? "evento con inscripción abierta" : "eventos con inscripción abierta"}`;
  const groups = groupByMonth(events).map(({ key, heading, name, ofMonth, events: grouped }) => ({
    key,
    heading,
    name,
    ofMonth,
    count: grouped.length,
    rows: (
      <ul className="reg-list">
        {grouped.map((event) => (
          <RegistrationCard key={event.slug} event={event} signedIn={signedIn} />
        ))}
      </ul>
    ),
  }));

  return (
    <>
      <p className="ticket-kicker" data-tone={events.length === 0 ? "off" : undefined}>
        <i aria-hidden="true" />
        {kicker}
      </p>
      <h1 className="reg-title">Inscripciones</h1>
      <p className="reg-lead">{signedIn ? `${LEAD} Con su cuenta UNL se inscribe con un clic.` : `${LEAD} Reserve su cupo en un minuto.`}</p>

      {problem ? (
        <p role="alert" className="reg-problem">
          {LOGIN_PROBLEM_MESSAGES[problem]}
        </p>
      ) : null}

      {events.length === 0 ? (
        <div className="reg-empty">
          <h2 className="reg-empty-title">No hay inscripciones abiertas.</h2>
          <p>Cuando la directiva abra una, la verá aquí.</p>
        </div>
      ) : (
        <RegistrationMonths total={events.length} groups={groups} />
      )}
    </>
  );
}
