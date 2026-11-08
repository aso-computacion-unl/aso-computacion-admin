"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { TurnstileWidget } from "./turnstile-widget";

const PRIVACY_NOTE = "Usamos tus datos solo para esta actividad y los eliminamos 90 días después de que termine. No verificamos tu correo.";
const MISSING_CHECK = "No pudimos comprobar que eres una persona. Completa la verificación e inténtalo de nuevo.";
const SEMESTERS = Array.from({ length: 12 }, (_, index) => String(index + 1));

type Phase = { name: "form" } | { name: "registered" } | { name: "ended"; message: string };

interface OpenRegistrationFormProps {
  slug: string;
  title: string;
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
export function OpenRegistrationForm({ slug, title, siteKey, calendarHref, closedMessage }: OpenRegistrationFormProps) {
  const router = useRouter();
  const id = useId();
  const [values, setValues] = useState<OpenFormValues>({ name: "", email: "", career: "", semester: "" });
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
      <div ref={doneBox} role="status" tabIndex={-1} className="grid gap-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky">
        <p className="flex gap-2.5 font-semibold">
          <Icon name="check" className="mt-0.5 size-4.5 shrink-0 text-ok" />
          Quedaste inscrito en {title}.
        </p>
        <p className="text-sm text-mist">Guarda la fecha y el lugar: no te enviaremos un correo de confirmación.</p>
        {calendarHref ? (
          <Button asChild variant="line" className="justify-self-start">
            <a href={calendarHref}>
              <Icon name="events" />
              Añadir al calendario
            </a>
          </Button>
        ) : null}
      </div>
    );
  }

  if (phase.name === "form" && closedMessage) return <p role="status">{closedMessage}</p>;

  if (phase.name === "ended") {
    return (
      <div ref={doneBox} role="status" tabIndex={-1} className="outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky">
        <p>{phase.message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={pending || undefined} className="grid max-w-lg gap-4">
      <RegistrationField id={fieldId("name")} label="Nombre completo" error={errors.name}>
        {(described) => (
          <Input
            id={fieldId("name")}
            name="name"
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
          <Input
            id={fieldId("email")}
            name="email"
            type="email"
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
      <RegistrationField id={fieldId("career")} label="Carrera" error={errors.career}>
        {(described) => (
          <Input
            id={fieldId("career")}
            name="career"
            value={values.career}
            onChange={(event) => change("career", event.target.value)}
            autoComplete="off"
            required
            aria-describedby={described}
            aria-invalid={errors.career ? true : undefined}
          />
        )}
      </RegistrationField>
      <RegistrationField id={fieldId("semester")} label="Semestre" error={errors.semester}>
        {(described) => (
          <Select
            id={fieldId("semester")}
            name="semester"
            value={values.semester}
            onChange={(event) => change("semester", event.target.value)}
            required
            aria-describedby={described}
            aria-invalid={errors.semester ? true : undefined}
          >
            <option value="">Elige tu semestre</option>
            {SEMESTERS.map((semester) => (
              <option key={semester} value={semester}>
                {semester}
              </option>
            ))}
          </Select>
        )}
      </RegistrationField>

      {siteKey ? (
        <TurnstileWidget
          siteKey={siteKey}
          resetCount={resetCount}
          onToken={(value) => {
            token.current = value;

            if (value) setNotice(null);
          }}
          onError={() => say(CAPTCHA_LOAD_MESSAGE)}
        />
      ) : null}

      <p className="text-sm text-mist">{PRIVACY_NOTE}</p>

      {notice ? (
        <div ref={noticeBox} role="alert" tabIndex={-1} className="flex gap-2 rounded-lg border border-error/45 bg-signal/15 p-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-error" />
          <p>{notice.message}</p>
        </div>
      ) : null}

      <Button type="submit" busy={pending} aria-disabled={pending || undefined} className="min-h-12 justify-self-start">
        {pending ? "Enviando…" : "Inscribirme"}
      </Button>
    </form>
  );
}
