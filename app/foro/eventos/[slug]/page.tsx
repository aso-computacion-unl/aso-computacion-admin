import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icons";
import { formatEventDate } from "@/interface/admin/events/event-timeline";
import { getEventRegistrationPage } from "@/interface/forum/event-registration-read";

import { GoogleMark } from "../../_components/google-mark";
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
    <>
      <Link href="/foro" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-mist hover:text-foreground">
        <Icon name="left" className="size-4" />
        Foro
      </Link>
      <section aria-labelledby="event-title" className="mt-1 grid max-w-2xl gap-4">
        <h1 id="event-title" className="text-[clamp(1.5rem,3.2vw,2rem)] leading-[1.2] font-bold font-stretch-[106%] tracking-tight wrap-anywhere">
          {event.title}
        </h1>
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
            {/* The same white Google button as the forum's sign-in gate. A plain link, not next/link: it starts a redirect flow and must not be prefetched. */}
            <a
              href="/foro/auth/google/start"
              className="inline-flex min-h-12 w-fit items-center justify-center gap-3 rounded border border-white bg-white px-6 font-bold text-[#1f1f1f] shadow-[0_6px_20px_-8px_rgb(0_0_0/0.45)] transition-colors hover:bg-[#e9eef5]"
            >
              <GoogleMark className="size-5" />
              Entrar con Google
            </a>
          </>
        )}
      </section>
    </>
  );
}
