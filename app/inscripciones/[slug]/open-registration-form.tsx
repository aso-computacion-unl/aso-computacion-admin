"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Icon } from "@/components/icons";
import {
  CAPTCHA_LOAD_MESSAGE,
  endsRegistration,
  fieldMessage,
  OPEN_FIELDS,
  openPayload,
  outcomeMessage,
  submitOpenRegistration,
  validateOpenForm,
  type OpenField,
  type OpenFieldErrors,
  type OpenFormValues,
} from "@/interface/event-registration/open-registration";

import { RegistrationField } from "../_components/registration-field";
import { ArrowGlyph, CalendarLink, CheckMark } from "../_components/ticket-parts";
import { TurnstileWidget } from "./turnstile-widget";

const PRIVACY_NOTE = "Usamos tus datos solo para esta actividad y los eliminamos 90 días después de que termine. No verificamos tu correo.";
const MISSING_CHECK = "No pudimos comprobar que eres una persona. Completa la verificación e inténtalo de nuevo.";
const SEMESTERS = Array.from({ length: 12 }, (_, index) => String(index + 1));

type Phase = { name: "form" } | { name: "registered" } | { name: "ended"; message: string };

interface OpenRegistrationFormProps {
  slug: string;
  /** Cloudflare Turnstile's public key; without it the form sends no token and the server decides. */
  siteKey: string | undefined;
  /** The event's `.ics`, offered once the person is in; null when there is nothing to add. */
  calendarHref: string | null;
  /**
   * Why registration is over (full or closed), as the server sees it now; undefined while it is open. The page keeps
   * the form mounted either way, so whoever takes the last seat keeps their confirmation after the refresh.
   */
  closedMessage?: string;
}

/**
 * The public registration form of an event: no session, no account. It validates before sending, posts to the
 * same endpoint the landing used (so every server rule applies), and says what happened in the place the person
 * is looking: under the field it concerns, or in one alert for everything else.
 */
export function OpenRegistrationForm({ slug, siteKey, calendarHref, closedMessage }: OpenRegistrationFormProps) {
  const router = useRouter();
  const id = useId();
  const [values, setValues] = useState<OpenFormValues>({ name: "", email: "", institution: "", career: "", semester: "" });
  const [errors, setErrors] = useState<OpenFieldErrors>({});
  const [notice, setNotice] = useState<{ message: string; shown: number } | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "form" });
  const [pending, setPending] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const sending = useRef(false);
  const token = useRef<string | null>(null);
  const noticeBox = useRef<HTMLDivElement>(null);
  const doneBox = useRef<HTMLDivElement>(null);

  const fieldId = (field: OpenField) => `${id}-${field}`;

  function focusField(field: OpenField) {
    document.getElementById(fieldId(field))?.focus();
  }

  // The alert and the confirmation take the focus when they appear: a keyboard user would otherwise never reach them.
  useEffect(() => {
    if (notice) noticeBox.current?.focus();
  }, [notice]);

  useEffect(() => {
    if (phase.name !== "form") doneBox.current?.focus();
  }, [phase]);

  function say(message: string) {
    setNotice((previous) => ({ message, shown: (previous?.shown ?? 0) + 1 }));
  }

  function change(field: OpenField, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (sending.current) return;

    setNotice(null);

    const invalid = validateOpenForm(values);
    const firstInvalid = OPEN_FIELDS.find((field) => invalid[field]);

    setErrors(invalid);

    if (firstInvalid) return focusField(firstInvalid);

    if (siteKey && !token.current) return say(MISSING_CHECK);

    sending.current = true;
    setPending(true);

    const outcome = await submitOpenRegistration(slug, openPayload(values, token.current));

    // A Turnstile token works once, whatever the answer was.
    token.current = null;
    setResetCount((count) => count + 1);
    sending.current = false;
    setPending(false);

    if (outcome.kind === "registered") {
      setPhase({ name: "registered" });
      router.refresh();
    } else if (outcome.kind === "field") {
      setErrors({ [outcome.field]: fieldMessage(outcome.field, values[outcome.field]) });
      focusField(outcome.field);
    } else if (outcome.kind === "duplicate") {
      setErrors({ email: outcomeMessage(outcome) });
      focusField("email");
    } else if (endsRegistration(outcome)) {
      setPhase({ name: "ended", message: outcomeMessage(outcome) });
      router.refresh();
    } else {
      say(outcomeMessage(outcome, { widget: Boolean(siteKey) }));
    }
  }

  if (phase.name === "registered") {
    return (
      <div ref={doneBox} role="status" tabIndex={-1} className="stub-done">
        <CheckMark />
        <div>
          <h2 className="stub-title">Listo, su cupo está reservado</h2>
          <p className="stub-text">
            Guarde la fecha y el lugar: <strong>no enviamos correo de confirmación.</strong>
          </p>
        </div>
        {calendarHref ? (
          <div className="stub-actions">
            <CalendarLink href={calendarHref} />
          </div>
        ) : null}
      </div>
    );
  }

  if (phase.name === "form" && closedMessage) return <p role="status" className="stub-closed">{closedMessage}</p>;

  if (phase.name === "ended") {
    return (
      <div ref={doneBox} role="status" tabIndex={-1} className="stub-done">
        <p className="stub-closed">{phase.message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={pending || undefined} className="stub-form">
      <p className="stub-legend">Su nombre en el boleto</p>
      <div className="stub-fields">
        <RegistrationField id={fieldId("name")} label="Nombre completo" error={errors.name}>
          {(described) => (
            <input
              id={fieldId("name")}
              name="name"
              className="ticket-input"
              value={values.name}
              onChange={(event) => change("name", event.target.value)}
              autoComplete="name"
              required
              aria-describedby={described}
              aria-invalid={errors.name ? true : undefined}
            />
          )}
        </RegistrationField>
        <RegistrationField id={fieldId("email")} label="Correo" error={errors.email}>
          {(described) => (
            <input
              id={fieldId("email")}
              name="email"
              type="email"
              className="ticket-input"
              inputMode="email"
              value={values.email}
              onChange={(event) => change("email", event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              aria-describedby={described}
              aria-invalid={errors.email ? true : undefined}
            />
          )}
        </RegistrationField>
        <RegistrationField id={fieldId("institution")} label="Institución" error={errors.institution}>
          {(described) => (
            <input
              id={fieldId("institution")}
              name="institution"
              className="ticket-input"
              value={values.institution}
              onChange={(event) => change("institution", event.target.value)}
              autoComplete="organization"
              required
              aria-describedby={described}
              aria-invalid={errors.institution ? true : undefined}
            />
          )}
        </RegistrationField>
        <div className="stub-pair">
          <RegistrationField id={fieldId("career")} label="Carrera (opcional)" error={errors.career}>
            {(described) => (
              <input
                id={fieldId("career")}
                name="career"
                className="ticket-input"
                value={values.career}
                onChange={(event) => change("career", event.target.value)}
                autoComplete="off"
                aria-describedby={described}
                aria-invalid={errors.career ? true : undefined}
              />
            )}
          </RegistrationField>
          <RegistrationField id={fieldId("semester")} label="Ciclo (opcional)" error={errors.semester}>
            {(described) => (
              <select
                id={fieldId("semester")}
                name="semester"
                className="ticket-input"
                value={values.semester}
                onChange={(event) => change("semester", event.target.value)}
                aria-describedby={described}
                aria-invalid={errors.semester ? true : undefined}
              >
                <option value="">—</option>
                {SEMESTERS.map((semester) => (
                  <option key={semester} value={semester}>
                    {semester}
                  </option>
                ))}
              </select>
            )}
          </RegistrationField>
        </div>
      </div>

      <div className="stub-go">
        {notice ? (
          <div ref={noticeBox} role="alert" tabIndex={-1} className="stub-alert">
            <Icon name="alert" className="size-4" />
            <p>{notice.message}</p>
          </div>
        ) : null}

        {siteKey ? (
          // Cloudflare's check is 300px wide: on the narrowest phones it reaches into the tear-off's padding, never past the page.
          <div>
            <TurnstileWidget
              siteKey={siteKey}
              resetCount={resetCount}
              onToken={(value) => {
                token.current = value;

                if (value) setNotice(null);
              }}
              onError={() => say(CAPTCHA_LOAD_MESSAGE)}
            />
          </div>
        ) : null}

        <p className="stub-note">{PRIVACY_NOTE}</p>

        <button type="submit" className="ticket-cta" aria-disabled={pending || undefined}>
          {pending ? "Enviando…" : "Reservar mi cupo"}
          {pending ? null : <ArrowGlyph />}
        </button>
      </div>
    </form>
  );
}
