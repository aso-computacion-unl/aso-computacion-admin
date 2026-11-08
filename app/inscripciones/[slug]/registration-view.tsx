import type { RegistrationState } from "@/application";
import type { EventRegistrationPage } from "@/interface/forum/event-registration-read";

import { PassGoogleButton } from "../_components/pass-google-button";
import { CalendarLink, StubDone } from "../_components/ticket-parts";
import { EventTicket } from "./event-ticket";
import { OpenRegistrationForm } from "./open-registration-form";
import { RegisterButton } from "./register-button";

/** The form is not offered when its spam check cannot run on this page (operator misconfiguration, already logged). */
const UNAVAILABLE_MESSAGE = "La inscripción no está disponible en este momento. Inténtalo de nuevo en unos minutos.";

const CLOSED_MESSAGES = {
  full: "Ya no quedan cupos para este evento.",
  closed: "Las inscripciones de este evento ya cerraron.",
} as const satisfies Record<Exclude<RegistrationState, "open">, string>;

/** The event's page for what the server read: the ticket and, in its tear-off, the action its registration mode allows. */
export function RegistrationView({ page, slug }: { page: EventRegistrationPage; slug: string }) {
  if (page.kind === "none") {
    return (
      <EventTicket event={page.event} mode="none">
        <div className="stub-row">
          <div>
            <p className="stub-legend">Pase libre</p>
            <h2 className="stub-title">No necesita inscribirse: solo llegue.</h2>
            {page.calendarHref ? <p className="stub-text">Guarde la fecha en su calendario para no olvidarla.</p> : null}
          </div>
          {page.calendarHref ? (
            <div className="stub-actions">
              <CalendarLink href={page.calendarHref} />
            </div>
          ) : null}
        </div>
      </EventTicket>
    );
  }

  const { status } = page;

  if (page.kind === "open") {
    return (
      <EventTicket event={status.event} mode="open" registration={status}>
        {page.captchaMisconfigured ? (
          <p role="status" className="stub-closed">
            {UNAVAILABLE_MESSAGE}
          </p>
        ) : (
          /* Always the form: when it is full or closed it says so, unless this visitor just took the last seat. */
          <OpenRegistrationForm slug={slug} siteKey={page.siteKey} calendarHref={page.calendarHref} closedMessage={status.state === "open" ? undefined : CLOSED_MESSAGES[status.state]} />
        )}
      </EventTicket>
    );
  }

  const { member } = page;
  // The Google sign-in is the forum's (one identity for both); it brings the visitor back to this page.
  const signIn = `/foro/auth/google/start?next=${encodeURIComponent(`/inscripciones/${slug}`)}`;

  return (
    <EventTicket event={status.event} mode="unl" registration={status}>
      {status.alreadyRegistered ? (
        <StubDone title="Usted ya está inscrito en este evento." calendarHref={page.calendarHref}>
          No necesita hacer nada más. Guarde la fecha y el lugar: <strong>no enviamos correo de confirmación.</strong>
        </StubDone>
      ) : status.state !== "open" ? (
        <p role="status" className="stub-closed">
          {CLOSED_MESSAGES[status.state]}
        </p>
      ) : member ? (
        <div className="stub-row">
          <div>
            <p className="stub-legend">Entrada</p>
            <p className="stub-line">
              Se reservará a nombre de <strong>{member.displayName}</strong>
            </p>
            <p className="stub-text">Con su cuenta institucional. Solo se guardan su nombre y su correo.</p>
          </div>
          <RegisterButton slug={slug} />
        </div>
      ) : (
        <div className="stub-row">
          <div>
            <p className="stub-legend">Entrada</p>
            <p className="stub-line">
              Entre con su correo <strong>@unl.edu.ec</strong> para reservar su cupo.
            </p>
            <p className="stub-text">Al entrar volverá a esta página para confirmarla.</p>
          </div>
          <PassGoogleButton href={signIn}>Entrar con Google</PassGoogleButton>
        </div>
      )}
    </EventTicket>
  );
}
