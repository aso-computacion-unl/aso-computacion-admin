import type { RegistrationState } from "@/application";
import { Icon } from "@/components/icons";
import type { EventRegistrationPage } from "@/interface/forum/event-registration-read";
import type { ForumLoginErrorCode } from "@/interface/forum/forum-login-errors";

import { LOGIN_PROBLEM_MESSAGES, registrationSignInHref } from "../_components/login-problems";
import { PassGoogleButton } from "../_components/pass-google-button";
import { CalendarLink, StubDone } from "../_components/ticket-parts";
import { EventTicket } from "./event-ticket";
import { OpenRegistrationForm } from "./open-registration-form";
import { RegisterButton } from "./register-button";

/** The form is not offered when its spam check cannot run on this page (operator misconfiguration, already logged). */
const UNAVAILABLE_MESSAGE = "La inscripción no está disponible en este momento. Inténtelo de nuevo en unos minutos.";

/** The UNL registration needs the Google login; where it is not configured, the page says so instead of offering a sign-in that ends in an error (S8). */
const LOGIN_UNAVAILABLE_MESSAGE = "La inscripción con cuenta UNL no está disponible en este momento. Inténtelo de nuevo más tarde.";

const CLOSED_MESSAGES = {
  full: "Ya no quedan cupos para este evento.",
  closed: "Las inscripciones de este evento ya cerraron.",
} as const satisfies Record<Exclude<RegistrationState, "open">, string>;

interface RegistrationViewProps {
  page: EventRegistrationPage;
  slug: string;
  /** Why the sign-in that brought the visitor back here failed (the `?error=` of the redirect), if it did. */
  problem?: ForumLoginErrorCode;
}

/** The event's page for what the server read: the ticket and, in its tear-off, the action its registration mode allows. */
export function RegistrationView({ page, slug, problem }: RegistrationViewProps) {
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
          <OpenRegistrationForm slug={slug} siteKey={page.siteKey} closedMessage={status.state === "open" ? undefined : CLOSED_MESSAGES[status.state]} />
        )}
      </EventTicket>
    );
  }

  const { member, loginAvailable } = page;
  // The Google sign-in is the forum's (one identity for both); it brings the visitor back to this page.
  const signIn = registrationSignInHref(slug);

  return (
    <EventTicket event={status.event} mode="unl" registration={status}>
      {status.alreadyRegistered ? (
        <StubDone title="Usted ya está inscrito en este evento." calendarHref={page.calendarHref}>
          {page.remindersOn ? (
            <>No necesita hacer nada más. Guarde la fecha y el lugar: unos días antes del evento le enviaremos un recordatorio a su correo.</>
          ) : (
            <>
              No necesita hacer nada más. Guarde la fecha y el lugar: <strong>no enviamos correo de confirmación.</strong>
            </>
          )}
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
          <RegisterButton slug={slug} signInHref={loginAvailable ? signIn : null} />
        </div>
      ) : !loginAvailable ? (
        <p role="status" className="stub-closed">
          {LOGIN_UNAVAILABLE_MESSAGE}
        </p>
      ) : (
        <div className="stub-row">
          <div>
            <p className="stub-legend">Entrada</p>
            {problem ? (
              <p role="alert" className="ticket-error">
                <Icon name="alert" />
                {LOGIN_PROBLEM_MESSAGES[problem]}
              </p>
            ) : null}
            <p className="stub-line">
              Entre con su correo <strong>@unl.edu.ec</strong> para reservar su cupo.
            </p>
            <p className="stub-text">Al entrar volverá a esta página para confirmarla.</p>
          </div>
          <PassGoogleButton href={signIn}>{problem ? "Intentar de nuevo" : "Entrar con Google"}</PassGoogleButton>
        </div>
      )}
    </EventTicket>
  );
}
