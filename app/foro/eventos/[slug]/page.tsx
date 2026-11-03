import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { formatEventDate } from "@/interface/admin/events/event-timeline";
import { getEventRegistrationPage } from "@/interface/forum/event-registration-read";

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
  const details = [event.date ? formatEventDate(event.date, event.datePrecision) : null, event.hora, event.lugar].filter(Boolean);

  return (
    <main className="mx-auto grid max-w-xl gap-4 p-6">
      <h1 className="font-display text-2xl wrap-anywhere">{event.title}</h1>
      {details.length > 0 ? <p className="text-mist">{details.join(" · ")}</p> : null}
      {status.deadline && status.state === "open" ? <p className="text-sm text-mist">Inscripciones hasta el {DEADLINE.format(status.deadline)} (hora de Ecuador).</p> : null}

      {status.alreadyRegistered ? (
        <p role="status">Usted ya está inscrito en este evento. No necesita hacer nada más.</p>
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
          <p>Para inscribirse, entre con su cuenta institucional de Google (@unl.edu.ec). Después de entrar, vuelva a abrir este enlace.</p>
          <a href="/foro/auth/google/start" className="justify-self-start font-semibold underline underline-offset-4">
            Entrar con Google
          </a>
        </>
      )}
    </main>
  );
}
