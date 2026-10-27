import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icons";
import { formatEventDate } from "@/interface/admin/events/event-timeline";
import { getEventRegistrationPage } from "@/interface/forum/event-registration-read";

import { GoogleButton } from "../../_components/google-button";
import { RegisterButton } from "./register-button";

// Reads the session cookie and the live seat count: never prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Inscripción al evento", robots: { index: false } };

const DEADLINE = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeStyle: "short", timeZone: "America/Guayaquil" });

const CLOSED_MESSAGES = {
  full: "Ya no quedan cupos para este evento.",
  closed: "Las inscripciones de este evento ya cerraron.",
} as const;

export default async function EventRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getEventRegistrationPage(slug);

  if (!page) notFound();

  const { member, status } = page;
  const { event } = status;
  const details = [
    { label: "Fecha", value: event.date ? formatEventDate(event.date, event.datePrecision) : null },
    { label: "Hora", value: event.hora },
    { label: "Lugar", value: event.lugar },
    { label: "Inscripciones hasta", value: status.deadline && status.state === "open" ? `${DEADLINE.format(status.deadline)} (hora de Ecuador)` : null },
  ].filter((detail): detail is { label: string; value: string } => Boolean(detail.value));
  const seatsLeft = status.capacity === null ? null : Math.max(0, status.capacity - status.registered);
  const signIn = `/foro/auth/google/start?next=${encodeURIComponent(`/foro/eventos/${slug}`)}`;

  return (
    <>
      <Link href="/foro" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-mist hover:text-foreground">
        <Icon name="left" className="size-4" />
        Foro
      </Link>
      <div className="mt-1 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10">
        <section aria-labelledby="event-title" className="grid gap-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-sky">
            <Icon name="events" className="size-4" />
            Inscripción al evento
          </p>
          <h1 id="event-title" className="text-[clamp(1.5rem,3.2vw,2rem)] leading-[1.2] font-bold font-stretch-[106%] tracking-tight text-balance wrap-anywhere">
            {event.title}
          </h1>
          {event.description ? (
            <p data-slot="event-description" className="whitespace-pre-line wrap-anywhere">
              {event.description}
            </p>
          ) : null}
          {seatsLeft !== null && status.capacity !== null ? (
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Icon name="board" className="size-4 text-sky" />
              {seatsLeft === 1 ? "Queda" : "Quedan"} {seatsLeft} de {status.capacity} cupos
            </p>
          ) : null}
          {details.length > 0 ? (
            <dl className="grid overflow-hidden rounded-lg border border-border sm:grid-cols-2">
              {details.map(({ label, value }) => (
                <div key={label} className="grid gap-0.5 border-b border-border px-4 py-3 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                  <dt className="text-xs font-semibold tracking-wide text-mist uppercase">{label}</dt>
                  <dd className="wrap-anywhere">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>

        <aside aria-label="Su inscripción" className="grid gap-4 rounded-lg border border-border bg-muted p-5 lg:sticky lg:top-22">
          {status.alreadyRegistered ? (
            <p role="status" className="flex gap-2.5">
              <Icon name="check" className="mt-0.5 size-4.5 shrink-0 text-ok" />
              Usted ya está inscrito en este evento. No necesita hacer nada más.
            </p>
          ) : status.state !== "open" ? (
            <p role="status">{CLOSED_MESSAGES[status.state]}</p>
          ) : member ? (
            <>
              <p>
                Se inscribirá como <strong>{member.displayName}</strong> con su cuenta institucional. Solo se guardan su nombre y su correo.
              </p>
              <RegisterButton slug={slug} />
            </>
          ) : (
            <>
              <p>
                La inscripción es con su cuenta institucional de Google <strong className="font-semibold">@unl.edu.ec</strong>. Al entrar volverá a esta página para confirmarla.
              </p>
              <GoogleButton href={signIn}>Entrar con Google</GoogleButton>
              <p className="text-sm text-mist">La primera vez se crea su cuenta del foro: no hay que registrarse aparte.</p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
