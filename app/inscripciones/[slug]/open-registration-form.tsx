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
import { ArrowGlyph, CheckMark } from "../_components/ticket-parts";
import { TurnstileWidget } from "./turnstile-widget";

const PRIVACY_NOTE = "Usamos sus datos solo para esta actividad y los eliminamos 90 días después de que termine. Le enviaremos un correo para confirmar su dirección.";
const MISSING_CHECK = "No pudimos comprobar que usted es una persona. Complete la verificación e inténtelo de nuevo.";
const SEMESTERS = Array.from({ length: 12 }, (_, index) => String(index + 1));

type Phase = { name: "form" } | { name: "check_email"; email: string } | { name: "ended"; message: string };

interface OpenRegistrationFormProps {
  slug: string;
  /** Cloudflare Turnstile's public key; without it the form sends no token and the server decides. */
  siteKey: string | undefined;
  /**
   * Why registration is over (full or closed), as the server sees it now; undefined while it is open. The page keeps
   * the form mounted either way, so whoever just asked keeps their "check your email" notice if the event fills meanwhile.
   */
  closedMessage?: string;
}

/**
 * The public registration form of an event: no session, no account. It validates before sending, posts to the
 * same endpoint the landing used (so every server rule applies), and says what happened in the place the person
 * is looking: under the field it concerns, or in one alert for everything else.
 */
export function OpenRegistrationForm({ slug, siteKey, closedMessage }: OpenRegistrationFormProps) {
  const router = useRouter();
  const id = useId();
  const [values, setValues] = useState<OpenFormValues>({ name: "", email: "", institution: "", career: "", semester: "" });
  const [errors, setErrors] = useState<OpenFieldErrors>({});
  // `about` says what the alert concerns: the browser's own check (no token yet, or the widget did not load), which a
  // fresh token settles, or the server's answer, which stays until the person sends again.
  const [notice, setNotice] = useState<{ message: string; shown: number; about: "check" | "answer" } | null>(null);
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

  function say(message: string, about: "check" | "answer" = "answer") {
    setNotice((previous) => ({ message, about, shown: (previous?.shown ?? 0) + 1 }));
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

    if (siteKey && !token.current) return say(MISSING_CHECK, "check");

    sending.current = true;
    setPending(true);

    const outcome = await submitOpenRegistration(slug, openPayload(values, token.current));

    // A Turnstile token works once, whatever the answer was.
    token.current = null;
    setResetCount((count) => count + 1);
    sending.current = false;
    setPending(false);

    if (outcome.kind === "registered") {
      // Pending: no seat is taken until the person opens the link we just emailed, so the seats behind do not change.
      setPhase({ name: "check_email", email: values.email.trim() });
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

  if (phase.name === "check_email") {
    return (
      <div ref={doneBox} role="status" tabIndex={-1} className="stub-done">
        <CheckMark />
        <div>
          <h2 className="stub-title">Revise su correo</h2>
          <p className="stub-text">
            Le enviamos un enlace a <strong>{phase.email}</strong>. Su cupo se reserva cuando lo abra y pulse <strong>«Confirmar mi cupo»</strong>; el enlace vale 48 horas. Si no lo ve, busque en la carpeta de correo no deseado.
          </p>
        </div>
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

                // The widget is reset after every answer and usually passes again by itself: that new token must not
                // erase what the server just said.
                if (value) setNotice((previous) => (previous?.about === "check" ? null : previous));
              }}
              onError={() => say(CAPTCHA_LOAD_MESSAGE, "check")}
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
